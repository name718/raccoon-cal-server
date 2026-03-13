import Joi from 'joi';

// 验证码验证规则
export const captchaVerifyValidator = Joi.object({
  captchaId: Joi.string().uuid().required().messages({
    'string.uuid': '验证码ID格式不正确',
    'any.required': '验证码ID不能为空',
  }),
  captchaCode: Joi.string().length(4).required().messages({
    'string.length': '验证码必须是4位',
    'any.required': '验证码不能为空',
  }),
});
