const tempUsers = new Map();

exports.setTempUser = (email, data) => {
  // Store data with a 15-minute expiration
  tempUsers.set(email, { data, expiresAt: Date.now() + 15 * 60 * 1000 });
};

exports.getTempUser = (email) => {
  const record = tempUsers.get(email);
  if (!record) return null;
  
  if (record.expiresAt < Date.now()) {
    tempUsers.delete(email);
    return null;
  }
  return record.data;
};

exports.deleteTempUser = (email) => {
  tempUsers.delete(email);
};

// Periodically clean up expired records to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of tempUsers.entries()) {
    if (record.expiresAt < now) {
      tempUsers.delete(email);
    }
  }
}, 60 * 60 * 1000); // Clean up every hour
