/**
 * DEPRECATED: Email notifications are now sent from the frontend (like OTP emails)
 * 
 * This script is kept for reference but is no longer used.
 * Order notification emails are sent from the frontend using @emailjs/browser
 * when notifications are received via Socket.IO.
 * 
 * To test email notifications, trigger an order update and check the frontend console.
 */

console.log('⚠️ This script is deprecated.');
console.log('📧 Order notification emails are now sent from the frontend.');
console.log('   To test, trigger an order update and check the browser console.\n');

process.exit(0);

// Old code below (kept for reference)
/*
require('dotenv').config();
const axios = require('axios');

async function testEmailJS(testEmail) {
  console.log('🧪 Testing EmailJS Configuration...\n');

  // Check environment variables
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const userKey = privateKey || publicKey;

  console.log('📋 Environment Variables:');
  console.log(`   EMAILJS_SERVICE_ID: ${serviceId ? '✓ Set (' + serviceId + ')' : '✗ Missing'}`);
  console.log(`   EMAILJS_TEMPLATE_ID: ${templateId ? '✓ Set (' + templateId + ')' : '✗ Missing'}`);
  console.log(`   EMAILJS_PRIVATE_KEY: ${privateKey ? '✓ Set (' + privateKey.substring(0, 8) + '...) - Server-side ready!' : '✗ Missing'}`);
  if (!privateKey && publicKey) {
    console.warn(`   EMAILJS_PUBLIC_KEY: ⚠️ Set (${publicKey.substring(0, 8)}...) - May not work server-side!`);
    console.warn('   ⚠️ WARNING: Public keys are for browser use only. Get a Private Key for server-side.');
  }
  console.log('');

  if (!serviceId || !templateId || !userKey) {
    console.error('EmailJS is not fully configured. Please check your .env file.');
    if (!privateKey) {
      console.error('');
      console.error('⚠️ IMPORTANT: For server-side usage, you need EMAILJS_PRIVATE_KEY');
      console.error('   Public keys only work in browsers and will return 403 errors from server.');
      console.error('   Get your private key from: https://dashboard.emailjs.com/admin/account');
    }
    process.exit(1);
  }

  if (!testEmail) {
    console.error('Please provide a test email address as an argument.');
    console.log('   Usage: node scripts/testEmailJS.js <test-email>');
    process.exit(1);
  }

  console.log(`📧 Sending test email to: ${testEmail}\n`);

  const templateParams = {
    to_email: testEmail,
    to_name: testEmail.split('@')[0],
    subject: 'Test Email from GASH Backend',
    message: 'This is a test email to verify EmailJS configuration. If you receive this, EmailJS is working correctly!',
    order_id: '#TEST1234',
  };

  console.log('📦 Template Parameters:');
  console.log(JSON.stringify(templateParams, null, 2));
  console.log('');

  const emailjsUrl = 'https://api.emailjs.com/api/v1.0/email/send';

  const requestBody = {
    service_id: serviceId,
    template_id: templateId,
    user_id: userKey,
    template_params: templateParams,
  };

  const headers = {
    'Content-Type': 'application/json',
  };

  // Add Authorization header if using private key
  if (privateKey) {
    headers['Authorization'] = `Bearer ${privateKey}`;
  }

  console.log('📤 Sending request to EmailJS API...');
  console.log(`   URL: ${emailjsUrl}`);
  console.log(`   Service ID: ${serviceId}`);
  console.log(`   Template ID: ${templateId}`);
  console.log(`   Key Type: ${privateKey ? 'Private Key (Server-side)' : 'Public Key (May fail)'}`);
  console.log('');

  try {
    const response = await axios.post(emailjsUrl, requestBody, {
      headers: headers,
      timeout: 15000,
    });

    console.log('SUCCESS!');
    console.log(`   Status: ${response.status}`);
    console.log(`   Status Text: ${response.statusText}`);
    if (response.data) {
      console.log(`   Response:`, JSON.stringify(response.data, null, 2));
    }
    console.log('\n📧 Test email should be sent. Please check your inbox (and spam folder).');
  } catch (error) {
    console.error('ERROR SENDING EMAIL:');
    console.error(`   Message: ${error.message}`);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Status Text: ${error.response.statusText}`);
      console.error(`   Response Data:`, JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 400) {
        console.error('\n💡 Common issues for 400 Bad Request:');
        console.error('   - Template ID might be incorrect');
        console.error('   - Template parameters don\'t match template variables');
        console.error('   - Service ID might be incorrect');
      } else if (error.response.status === 401) {
        console.error('\n💡 Common issues for 401 Unauthorized:');
        console.error('   - Public Key (user_id) might be incorrect');
        console.error('   - Account might be suspended or inactive');
      } else if (error.response.status === 404) {
        console.error('\n💡 Common issues for 404 Not Found:');
        console.error('   - Service ID or Template ID might be incorrect');
        console.error('   - Template might have been deleted');
      }
    } else if (error.request) {
      console.error('   No response received from EmailJS API');
      console.error('   This might indicate a network issue or EmailJS service is down');
    } else {
      console.error('   Error details:', error);
    }
    
    process.exit(1);
  }
}

// Get test email from command line arguments
const testEmail = process.argv[2];

// testEmailJS(testEmail);
*/

