export interface EmailInviteData {
  emails: string[];
  senderName: string;
  message: string;
  roomId?: string;
  roomName: string;
  inviteLink: string;
}
