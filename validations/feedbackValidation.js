const Joi = require('joi');

const addFeedbackSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required().messages({
    'number.base': 'Rating must be a number',
    'number.integer': 'Rating must be an integer',
    'number.min': 'Rating must be between 1 and 5',
    'number.max': 'Rating must be between 1 and 5',
    'any.required': 'Rating is required'
  }),
  content: Joi.string().trim().max(500).allow('', null).optional().messages({
    'string.max': 'Feedback cannot exceed 500 characters'
  })
});

const editFeedbackSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).optional().messages({
    'number.base': 'Rating must be a number',
    'number.integer': 'Rating must be an integer',
    'number.min': 'Rating must be between 1 and 5',
    'number.max': 'Rating must be between 1 and 5'
  }),
  content: Joi.string().trim().max(500).allow('', null).optional().messages({
    'string.max': 'Feedback cannot exceed 500 characters'
  })
}).or('rating', 'content').messages({
  'object.missing': 'Either rating or content (or both) is required to edit feedback'
});

module.exports = {
  addFeedbackSchema,
  editFeedbackSchema
};
