export const GENDER_OPTIONS = [
  { key: "", value: "register.gender.select" },
  { key: "male", value: "register.gender.male" },
  { key: "female", value: "register.gender.female" }
]

export const VALIDATION_RULES = {
  username: {
    pattern: /^[a-zA-Z0-9_.]+$/,
    message: "register.username.error1"
  },
  password: {
    minLength: 8,
    lowercase: /[a-z]/,
    uppercase: /[A-Z]/,
    numeric: /[0-9]/,
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
    message: "register.password.error1"
  },
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: "register.email.error1"
  }
}
