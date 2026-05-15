import { Request, Response } from "express";
import emailService, { EmailInviteData } from "../services/email.service";

export const sendInvitations = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const inviteData: EmailInviteData = req.body;

    const {
      emails, // array of email addresses
      senderName, // name of the sender
      inviteLink,
    }: EmailInviteData = inviteData;

    // Validate required fields
    const emailValidationError =
      !emails || !Array.isArray(emails) || emails.length === 0;

    if (emailValidationError) {
      return res.status(400).json({
        error: "Email addresses are required",
        message: "Please provide at least one email address",
      });
    }

    if (!senderName || !senderName.trim()) {
      return res.status(400).json({
        error: "Sender name is required",
        message: "Please provide the sender name",
      });
    }

    if (!inviteLink) {
      return res.status(400).json({
        error: "Invite link is required",
        message: "Invite link is missing",
      });
    }

    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter((email) => !emailRegex.test(email));

    if (invalidEmails.length > 0) {
      return res.status(400).json({
        error: "Invalid email addresses",
        message: "Some email addresses are not valid",
        invalidEmails,
      });
    }

    // Send invitations
    await emailService.sendInvitations(inviteData);

    res.status(200).json({
      success: true,
      message: `Invitations sent successfully to ${emails.length} recipients`,
      emailCount: emails.length,
    });
  } catch (error) {
    console.error("Failed to send invitations:", error);
    res.status(500).json({
      error: "Failed to send invitations",
      message:
        "An error occurred while sending the invitations. Please try again.",
    });
  }
};
