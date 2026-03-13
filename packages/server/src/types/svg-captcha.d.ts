declare module 'svg-captcha' {
  interface CaptchaOptions {
    size?: number;
    ignoreChars?: string;
    noise?: number;
    color?: boolean;
    background?: string;
    width?: number;
    height?: number;
  }

  interface CaptchaResult {
    data: string;
    text: string;
  }

  export function create(options?: CaptchaOptions): CaptchaResult;
}
