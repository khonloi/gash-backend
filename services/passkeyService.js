// passkeyService.js
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const Accounts = require('../models/Accounts');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authMiddleware');

// Get RP (Relying Party) configuration
const rpName = 'GASH';
// For localhost, rpID should be 'localhost' (without http:// or port)
// For production, rpID should be your domain (e.g., 'example.com')
const rpID = process.env.RP_ID || 'localhost';
// Origin must match the actual origin of the request (including protocol and port for localhost)
const origin = process.env.ORIGIN || 'http://localhost:5173';

console.log('Passkey Service initialized with:');
console.log('  RP Name:', rpName);
console.log('  RP ID:', rpID);
console.log('  Origin:', origin);

/**
 * Generate registration options for passkey
 */
exports.generateRegistrationOptions = async (userId) => {
  try {
    console.log('Generating registration options for userId:', userId);
    console.log('RP_ID:', rpID, 'Origin:', origin);
    
    const account = await Accounts.findById(userId);
    if (!account) {
      return { status: 404, response: { message: 'User not found' } };
    }

    const userPasskeys = account.passkeys || [];
    console.log('User has', userPasskeys.length, 'existing passkeys');
    
    // Convert user ID to Buffer (required by SimpleWebAuthn)
    // Use the MongoDB ObjectId as bytes directly
    const userIDBuffer = Buffer.from(account._id.toString(), 'utf8');
    
    // Build registration options for device passkeys (Touch ID, Face ID, Windows Hello)
    const registrationOptions = {
      rpName,
      rpID,
      userID: userIDBuffer,
      userName: account.email,
      userDisplayName: account.name || account.username || account.email,
      timeout: 60000,
      attestationType: 'none',
      authenticatorSelection: {
        // Use 'platform' for device passkeys (Touch ID, Face ID, Windows Hello)
        // Use 'cross-platform' for security keys (YubiKey, etc.)
        authenticatorAttachment: 'platform', // Changed to 'platform' for device passkeys
        userVerification: 'required', // Required for passkeys
        requireResidentKey: true, // Required for passkeys
      },
      supportedAlgorithmIDs: [-7, -257],
    };
    
    // Only add excludeCredentials if there are existing passkeys
    if (userPasskeys.length > 0) {
      registrationOptions.excludeCredentials = userPasskeys.map(passkey => {
        try {
          // credentialID is stored as base64url string, convert to Buffer
          if (!passkey.credentialID) {
            console.warn('Passkey missing credentialID, skipping');
            return null;
          }
          
          let credentialIDBuffer;
          if (typeof passkey.credentialID === 'string') {
            // Validate it's a valid base64url string
            try {
              credentialIDBuffer = Buffer.from(passkey.credentialID, 'base64url');
              if (credentialIDBuffer.length === 0) {
                throw new Error('Empty credentialID after conversion');
              }
            } catch (err) {
              console.error('Invalid base64url credentialID in excludeCredentials:', passkey.credentialID);
              console.error('Error:', err.message);
              return null;
            }
          } else if (Buffer.isBuffer(passkey.credentialID)) {
            credentialIDBuffer = passkey.credentialID;
          } else {
            console.error('Unexpected credentialID type in excludeCredentials:', typeof passkey.credentialID);
            return null;
          }
          
          return {
            id: credentialIDBuffer,
            type: 'public-key',
            transports: ['usb', 'nfc', 'ble', 'internal'],
          };
        } catch (err) {
          console.error('Error processing passkey for excludeCredentials:', err);
          console.error('Passkey:', JSON.stringify(passkey, null, 2));
          return null;
        }
      }).filter(Boolean); // Remove any null entries
      
      console.log('Exclude credentials count:', registrationOptions.excludeCredentials?.length || 0);
    }
    
    const options = await generateRegistrationOptions(registrationOptions);

    return {
      status: 200,
      response: {
        options,
        challenge: options.challenge,
      },
    };
  } catch (error) {
    console.error('Error generating registration options:', error);
    console.error('Error stack:', error.stack);
    return { 
      status: 500, 
      response: { 
        message: 'Error generating registration options', 
        error: error.message,
        details: error.stack 
      } 
    };
  }
};

/**
 * Verify registration response and save passkey
 */
exports.verifyRegistration = async (userId, body, requestOrigin = null) => {
  try {
    console.log('Verifying registration for userId:', userId);
    console.log('Registration response received:', JSON.stringify(body, null, 2));
    
    const account = await Accounts.findById(userId);
    if (!account) {
      return { status: 404, response: { message: 'User not found' } };
    }

    // The challenge should come from the original options, not from the response
    // The response contains clientDataJSON which has the challenge embedded
    const expectedChallenge = body.challenge;
    if (!expectedChallenge) {
      console.error('Challenge missing from request body');
      return { status: 400, response: { message: 'Challenge is required' } };
    }

    // Use request origin if provided, otherwise fall back to configured origin
    const expectedOrigin = requestOrigin || origin;
    
    console.log('Expected challenge:', expectedChallenge);
    console.log('Expected origin:', expectedOrigin);
    console.log('Request origin:', requestOrigin);
    console.log('Configured origin:', origin);
    console.log('Expected RPID:', rpID);
    
    // Log the response structure to debug
    if (body.response) {
      console.log('Response structure present');
      if (body.response.clientDataJSON) {
        try {
          const clientData = JSON.parse(Buffer.from(body.response.clientDataJSON, 'base64url').toString('utf8'));
          console.log('Client data challenge:', clientData.challenge);
          console.log('Client data origin:', clientData.origin);
          console.log('Client data type:', clientData.type);
          
          // Compare challenges
          if (clientData.challenge !== expectedChallenge) {
            console.error('Challenge mismatch!');
            console.error('  Expected:', expectedChallenge);
            console.error('  Received:', clientData.challenge);
          } else {
            console.log('✓ Challenge matches');
          }
          
          // Compare origins
          if (clientData.origin !== expectedOrigin) {
            console.error('Origin mismatch!');
            console.error('  Expected:', expectedOrigin);
            console.error('  Received:', clientData.origin);
          } else {
            console.log('✓ Origin matches');
          }
        } catch (e) {
          console.error('Error parsing clientDataJSON:', e);
        }
      }
    }

    let verification;
    try {
      // SimpleWebAuthn v13 expects id and rawId to be the SAME base64url string
      // The library checks: if (id !== rawId) throw new Error('Credential ID was not base64url-encoded')
      // So we must NOT convert rawId to Buffer - keep both as base64url strings
      
      // Ensure both id and rawId are base64url strings (they should already be from the browser)
      const id = body.id;
      let rawId = body.rawId;
      
      // If rawId is missing, use id (they should be the same)
      if (!rawId && id) {
        rawId = id;
      }
      
      // Both must be strings (base64url encoded)
      if (typeof id !== 'string' || typeof rawId !== 'string') {
        throw new Error('id and rawId must be base64url strings');
      }
      
      // Build the response object exactly as SimpleWebAuthn expects
      // SimpleWebAuthn v13 expects both id and rawId to be the same base64url string
      const webauthnResponse = {
        id: id,
        rawId: rawId, // Keep as string, NOT Buffer!
        response: body.response, // Pass the entire response object as-is
        type: body.type || 'public-key',
      };
      
      console.log('WebAuthn response prepared:', {
        hasId: !!webauthnResponse.id,
        hasRawId: !!webauthnResponse.rawId,
        hasClientDataJSON: !!webauthnResponse.response.clientDataJSON,
        hasAttestationObject: !!webauthnResponse.response.attestationObject,
        type: webauthnResponse.type
      });
      
      // Verify the registration response
      // expectedChallenge should be the challenge string from the original options
      // Use 'preferred' instead of 'required' to match registration options
      verification = await verifyRegistrationResponse({
        response: webauthnResponse,
        expectedChallenge: expectedChallenge,
        expectedOrigin: expectedOrigin,
        expectedRPID: rpID,
        requireUserVerification: true, // Required for passkeys
      });
      
      console.log('Verification result:', {
        verified: verification.verified,
        hasRegistrationInfo: !!verification.registrationInfo
      });
      
      if (verification.registrationInfo) {
        console.log('Registration info keys:', Object.keys(verification.registrationInfo));
        console.log('Registration info credentialID type:', typeof verification.registrationInfo.credentialID);
        console.log('Registration info credentialID is Buffer:', Buffer.isBuffer(verification.registrationInfo.credentialID));
        console.log('Registration info credentialPublicKey type:', typeof verification.registrationInfo.credentialPublicKey);
      }
    } catch (error) {
      console.error('Verification error:', error);
      console.error('Verification error stack:', error.stack);
      return { 
        status: 400, 
        response: { 
          message: 'Verification failed', 
          error: error.message,
          details: error.stack 
        } 
      };
    }

    const { verified, registrationInfo } = verification;

    console.log('Verification result - verified:', verified);
    console.log('Registration info:', registrationInfo ? 'present' : 'missing');

    if (verified && registrationInfo) {
      // SimpleWebAuthn v13 structure: credentialID is in registrationInfo.credential.id
      // and credentialPublicKey is in registrationInfo.credential.publicKey
      const credential = registrationInfo.credential;
      
      if (!credential) {
        console.error('credential is missing from registrationInfo');
        console.error('registrationInfo keys:', Object.keys(registrationInfo));
        return { 
          status: 400, 
          response: { 
            message: 'Verification failed: credential missing', 
            error: 'Registration info missing credential object'
          } 
        };
      }
      
      // credentialID is already a base64url string in registrationInfo.credential.id
      const credentialIDStr = credential.id;
      const credentialPublicKey = credential.publicKey;
      const counter = credential.counter || 0;
      
      // Validate credentialID exists
      if (!credentialIDStr) {
        console.error('credential.id is missing from registrationInfo.credential');
        console.error('registrationInfo:', JSON.stringify(registrationInfo, null, 2));
        return { 
          status: 400, 
          response: { 
            message: 'Verification failed: credential ID missing', 
            error: 'Registration info missing credential ID'
          } 
        };
      }
      
      // Validate credentialPublicKey exists
      if (!credentialPublicKey) {
        console.error('credential.publicKey is missing from registrationInfo.credential');
        return { 
          status: 400, 
          response: { 
            message: 'Verification failed: credential public key missing', 
            error: 'Registration info missing credential public key'
          } 
        };
      }

      console.log('Credential ID (length:', credentialIDStr.length, '):', credentialIDStr.substring(0, 20) + '...');
      
      const existingPasskey = account.passkeys.find(
        p => p.credentialID === credentialIDStr
      );

      if (existingPasskey) {
        return { status: 400, response: { message: 'Passkey already registered' } };
      }

      // credentialPublicKey is a Buffer/Uint8Array, convert to base64url string for storage
      let credentialPublicKeyStr;
      if (Buffer.isBuffer(credentialPublicKey)) {
        credentialPublicKeyStr = credentialPublicKey.toString('base64url');
      } else if (credentialPublicKey instanceof Uint8Array) {
        credentialPublicKeyStr = Buffer.from(credentialPublicKey).toString('base64url');
      } else if (credentialPublicKey instanceof ArrayBuffer) {
        credentialPublicKeyStr = Buffer.from(credentialPublicKey).toString('base64url');
      } else {
        // Try to convert
        try {
          credentialPublicKeyStr = Buffer.from(credentialPublicKey).toString('base64url');
        } catch (err) {
          console.error('Failed to convert credentialPublicKey to base64url:', err);
          return { 
            status: 400, 
            response: { 
              message: 'Verification failed: invalid credential public key format', 
              error: err.message
            } 
          };
        }
      }

      // Save passkey
      account.passkeys.push({
        credentialID: credentialIDStr,
        credentialPublicKey: credentialPublicKeyStr,
        counter: counter,
        deviceType: body.deviceType || 'unknown',
        backedUp: registrationInfo.credentialBackedUp || false,
      });

      await account.save();
      console.log('Passkey saved successfully');

      return {
        status: 200,
        response: {
          message: 'Passkey registered successfully',
          verified: true,
        },
      };
    }

    console.error('Verification failed - verified:', verified, 'registrationInfo:', registrationInfo);
    return { 
      status: 400, 
      response: { 
        message: 'Verification failed', 
        verified: verified,
        hasRegistrationInfo: !!registrationInfo
      } 
    };
  } catch (error) {
    console.error('Error verifying registration:', error);
    return { status: 500, response: { message: 'Error verifying registration', error: error.message } };
  }
};

/**
 * Generate authentication options for passkey login
 */
exports.generateAuthenticationOptions = async (username) => {
  try {
    const account = await Accounts.findOne({ username });
    if (!account) {
      return { status: 404, response: { message: 'User not found' } };
    }

    if (!account.passkeys || account.passkeys.length === 0) {
      return { status: 400, response: { message: 'No passkeys registered for this user' } };
    }

    const allowCredentials = account.passkeys.map(passkey => {
      try {
        // credentialID is stored as base64url string - keep it as a string!
        // SimpleWebAuthn expects id to be a base64url string, not a Buffer
        if (!passkey.credentialID) {
          console.warn('Passkey missing credentialID, skipping');
          return null;
        }
        
        // Ensure it's a string (it should already be base64url from storage)
        let credentialIDStr;
        if (typeof passkey.credentialID === 'string') {
          credentialIDStr = passkey.credentialID;
        } else if (Buffer.isBuffer(passkey.credentialID)) {
          // If somehow it's a Buffer, convert back to base64url string
          credentialIDStr = passkey.credentialID.toString('base64url');
        } else {
          console.error('Unexpected credentialID type:', typeof passkey.credentialID);
          return null;
        }
        
        // Validate it's not empty
        if (!credentialIDStr || credentialIDStr.length === 0) {
          console.error('Empty credentialID, skipping');
          return null;
        }
        
        return {
          id: credentialIDStr, // Keep as base64url string!
          type: 'public-key',
          transports: ['usb', 'nfc', 'ble', 'internal'],
        };
      } catch (err) {
        console.error('Error processing passkey for allowCredentials:', err);
        console.error('Passkey:', JSON.stringify(passkey, null, 2));
        return null;
      }
    }).filter(Boolean); // Remove any null entries
    
    if (allowCredentials.length === 0 && account.passkeys.length > 0) {
      console.error('All passkeys failed to convert! This indicates a data corruption issue.');
      console.error('Passkeys data:', JSON.stringify(account.passkeys, null, 2));
    }

    const options = await generateAuthenticationOptions({
      rpID,
      timeout: 60000,
      allowCredentials,
      userVerification: 'required', // Required for passkeys
    });

    return {
      status: 200,
      response: {
        options,
        challenge: options.challenge,
      },
    };
  } catch (error) {
    console.error('Error generating authentication options:', error);
    return { status: 500, response: { message: 'Error generating authentication options', error: error.message } };
  }
};

/**
 * Verify authentication response and login
 */
exports.verifyAuthentication = async (username, body, requestOrigin = null) => {
  try {
    const account = await Accounts.findOne({ username });
    if (!account) {
      return { status: 404, response: { message: 'User not found' } };
    }

    if (!account.passkeys || account.passkeys.length === 0) {
      return { status: 400, response: { message: 'No passkeys registered for this user' } };
    }

    const expectedChallenge = body.challenge;
    if (!expectedChallenge) {
      return { status: 400, response: { message: 'Challenge is required' } };
    }

    // Use request origin if provided, otherwise fall back to configured origin
    const expectedOrigin = requestOrigin || origin;

    // Find the passkey being used
    const credentialID = body.id;
    let passkey;
    
    // Convert received credentialID to base64url string for comparison
    let credentialIDStr;
    if (typeof credentialID === 'string') {
      credentialIDStr = credentialID;
    } else {
      credentialIDStr = Buffer.from(credentialID).toString('base64url');
    }
    
    // Find passkey by comparing credential IDs
    passkey = account.passkeys.find(p => p.credentialID === credentialIDStr);

    if (!passkey) {
      return { status: 400, response: { message: 'Passkey not found' } };
    }

    let verification;
    try {
      // SimpleWebAuthn v13 expects id and rawId to be the SAME base64url string
      // Ensure both are strings (they should already be from the browser)
      const id = body.id;
      let rawId = body.rawId;
      
      // If rawId is missing, use id (they should be the same)
      if (!rawId && id) {
        rawId = id;
      }
      
      // Both must be strings (base64url encoded)
      if (typeof id !== 'string' || typeof rawId !== 'string') {
        throw new Error('id and rawId must be base64url strings');
      }
      
      // Build the response object with id and rawId as strings
      const webauthnResponse = {
        id: id,
        rawId: rawId, // Keep as string, NOT Buffer!
        response: body.response,
        type: body.type || 'public-key',
      };
      
      // Convert stored credentialID and publicKey back to Buffers for credential
      // SimpleWebAuthn v13 expects: credential { id, publicKey, counter }
      const credentialIDBuffer = Buffer.from(passkey.credentialID, 'base64url');
      const credentialPublicKeyBuffer = Buffer.from(passkey.credentialPublicKey, 'base64url');
      
      verification = await verifyAuthenticationResponse({
        response: webauthnResponse,
        expectedChallenge,
        expectedOrigin: expectedOrigin,
        expectedRPID: rpID,
        credential: {
          id: credentialIDBuffer,  // Note: property name is 'id', not 'credentialID'
          publicKey: credentialPublicKeyBuffer,  // Note: property name is 'publicKey', not 'credentialPublicKey'
          counter: passkey.counter || 0,
        },
        requireUserVerification: true, // Required for passkeys
      });
    } catch (error) {
      console.error('Verification error:', error);
      return { status: 400, response: { message: 'Verification failed', error: error.message } };
    }

    const { verified, authenticationInfo } = verification;

    if (verified && authenticationInfo) {
      // Update counter
      passkey.counter = authenticationInfo.newCounter;
      await account.save();

      // Check account status
      if (account.accountStatus !== 'active') {
        return { status: 403, response: { message: 'Account is inactive or suspended' } };
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: account._id, username: account.username, role: account.role },
        JWT_SECRET,
        { expiresIn: '1d' }
      );

      return {
        status: 200,
        response: {
          message: 'Login successful',
          verified: true,
          token,
          account: {
            _id: account._id,
            username: account.username,
            name: account.name,
            email: account.email,
            phone: account.phone,
            address: account.address,
            image: account.image,
            role: account.role,
            accountStatus: account.accountStatus,
          },
        },
      };
    }

    return { status: 400, response: { message: 'Verification failed' } };
  } catch (error) {
    console.error('Error verifying authentication:', error);
    return { status: 500, response: { message: 'Error verifying authentication', error: error.message } };
  }
};

/**
 * Get user's passkeys
 */
exports.getUserPasskeys = async (userId) => {
  try {
    const account = await Accounts.findById(userId);
    if (!account) {
      return { status: 404, response: { message: 'User not found' } };
    }

    const passkeys = (account.passkeys || []).map(p => ({
      id: p._id,
      deviceType: p.deviceType,
      createdAt: p.createdAt,
      backedUp: p.backedUp,
    }));

    return {
      status: 200,
      response: {
        passkeys,
      },
    };
  } catch (error) {
    console.error('Error getting user passkeys:', error);
    return { status: 500, response: { message: 'Error getting user passkeys', error: error.message } };
  }
};

/**
 * Delete a passkey
 */
exports.deletePasskey = async (userId, passkeyId) => {
  try {
    const account = await Accounts.findById(userId);
    if (!account) {
      return { status: 404, response: { message: 'User not found' } };
    }

    account.passkeys = account.passkeys.filter(
      p => p._id.toString() !== passkeyId
    );

    await account.save();

    return {
      status: 200,
      response: {
        message: 'Passkey deleted successfully',
      },
    };
  } catch (error) {
    console.error('Error deleting passkey:', error);
    return { status: 500, response: { message: 'Error deleting passkey', error: error.message } };
  }
};

