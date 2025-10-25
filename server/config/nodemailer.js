import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_EMAIL, //updated from USER
    pass: process.env.SMTP_PASSWORD, // NOT your real Gmail password
  },
});

export default transporter;