import os
import smtplib
import asyncio
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")


def _send_email_sync(to_addrs: List[str], subject: str, body: str) -> bool:
    if not SMTP_HOST or not SMTP_USER or not to_addrs:
        logger.warning("Email not configured or no recipients; skipping send")
        return False

    msg = MIMEMultipart()
    msg["From"] = SMTP_FROM or SMTP_USER
    msg["To"] = ", ".join(to_addrs)
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=5) as server:
            server.starttls()
            if SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(msg["From"], to_addrs, msg.as_string())
        logger.info("Alert email sent to %s", to_addrs)
        return True
    except Exception as e:
        logger.error("Failed to send email: %s", e)
        return False


async def get_admin_emails(conn) -> List[str]:
    if ADMIN_EMAIL:
        return [e.strip() for e in ADMIN_EMAIL.split(",") if e.strip()]
    rows = await conn.fetch(
        "SELECT email FROM users WHERE role IN ('admin', 'viewer') ORDER BY created_at"
    )
    return [r["email"] for r in rows]


async def notify_admin(conn, subject: str, body: str) -> bool:
    recipients = await get_admin_emails(conn)
    if not recipients:
        logger.warning("No admin recipients for alert email")
        return False
    return await asyncio.to_thread(_send_email_sync, recipients, subject, body)


async def notify_alert(conn, alert_type: str, message: str, bin_name: str | None = None) -> bool:
    bin_label = bin_name or "Smart Bin"
    subjects = {
        "threshold_exceeded": f"[SmartBin] Capacity alert — {bin_label}",
        "gas_detected": f"[SmartBin] Gas/odor alert — {bin_label}",
    }
    subject = subjects.get(alert_type, f"[SmartBin] Alert — {bin_label}")
    body = (
        f"Smart Waste Bin Alert\n\n"
        f"Bin: {bin_label}\n"
        f"Type: {alert_type}\n"
        f"Message: {message}\n\n"
        f"Log in to the dashboard to review and resolve this alert."
    )
    return await notify_admin(conn, subject, body)
