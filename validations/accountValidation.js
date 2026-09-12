const Joi = require('joi');

const updateAccountSchema = Joi.object({
  username: Joi.string().min(3).max(30),
  name: Joi.string().allow('', null),
  email: Joi.string().email(),
  phone: Joi.string().allow('', null),
  address: Joi.string().allow('', null),
  image: Joi.string().uri().allow('', null),
  gender: Joi.string().valid('Male', 'Female', 'Other').allow('', null),
  dob: Joi.date().allow('', null),
  role: Joi.string().valid('user', 'manager', 'admin'),
  acc_status: Joi.string().valid('active', 'inactive', 'suspended', 'deleted'),
}).min(1);

const updatePasswordSchema = Joi.object({
  oldPassword: Joi.string().min(6).required(),
  newPassword: Joi.string().min(6).required()
});

module.exports = {
  updateAccountSchema,
  updatePasswordSchema
};
