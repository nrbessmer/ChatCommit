# app/utils/email.py
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig

conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("SMTP_USER"),
    MAIL_PASSWORD=os.getenv("SMTP_PASS"),
    MAIL_FROM=os.getenv("SMTP_FROM"),
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_TLS=True,
    MAIL_SSL=False,
)

async def send_extension_email(to_email: str, token: str):
    message = MessageSchema(
        subject="Your ChatCommit Extension Code & Instructions",
        recipients=[to_email],
        body=f"Your token is {token}\n\nSteps to install:\n1. Install …",
        subtype="plain",
    )
    fm = FastMail(conf)
    await fm.send_message(message)

