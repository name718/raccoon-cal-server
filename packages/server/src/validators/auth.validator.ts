import Joi from 'joi';

// 用户名验证规则
const usernameSchema = Joi.string()
  .alphanum()
  .min(3)
  .max(20)
  .required()
  .messages({
    'string.alphanum': '用户名只能包含字母和数字',
    'string.min': '用户名至少3个字符',
    'string.max': '用户名最多20个字符',
    'any.required': '用户名不能为空',
  });

// 密码验证规则
const passwordSchema = Joi.string().min(6).max(50).required().messages({
  'string.min': '密码至少6个字符',
  'string.max': '密码最多50个字符',
  'any.required': '密码不能为空',
});

// 邮箱验证规则
const emailSchema = Joi.string().email().max(100).messages({
  'string.email': '邮箱格式不正确',
  'string.max': '邮箱最多100个字符',
});

// 手机号验证规则
const phoneSchema = Joi.string()
  .pattern(/^1[3-9]\d{9}$/)
  .messages({
    'string.pattern.base': '手机号格式不正确',
  });

// 注册验证
export const registerValidator = Joi.object({
  username: usernameSchema,
  password: passwordSchema,
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
})
  .custom((value, helpers) => {
    // 至少需要提供邮箱或手机号其中一个
    if (!value.email && !value.phone) {
      return helpers.error('custom.emailOrPhone');
    }
    return value;
  })
  .messages({
    'custom.emailOrPhone': '请提供邮箱或手机号',
  });

// 登录验证
export const loginValidator = Joi.object({
  identifier: Joi.string().required().messages({
    'any.required': '请输入用户名、邮箱或手机号',
  }),
  password: passwordSchema,
});
