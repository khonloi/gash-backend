const Joi = require('joi');

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().allow('', null),
  phone: Joi.string().allow('', null),
  address: Joi.string().allow('', null),
  image: Joi.string().uri().allow('', null),
  gender: Joi.string().valid('Male', 'Female', 'Other').allow('', null),
  dob: Joi.date().allow('', null)
});

const loginSchema = Joi.object({
  username: Joi.string().required(), // This can be email or username
  password: Joi.string().required()
});

const emailSchema = Joi.object({
  email: Joi.string().email().required()
});

const verifyOtpSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).required()
});

const resetPasswordSchema = Joi.object({
  resetToken: Joi.string().required(),
  newPassword: Joi.string().min(6).required()
});

const googleLoginSchema = Joi.object({
  token: Joi.string().required()
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

module.exports = {
  registerSchema,
  loginSchema,
  emailSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  googleLoginSchema,
  refreshTokenSchema
};
