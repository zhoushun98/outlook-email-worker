export interface Env {
  DB: D1Database;
  API_TOKEN: string;
}

export interface GroupRow {
  id: number;
  name: string;
  description: string;
  color: string;
  created_at: string;
}

export interface GroupWithCount extends GroupRow {
  account_count: number;
}

export interface AccountRow {
  id: number;
  email: string;
  password: string;
  client_id: string;
  refresh_token: string;
  group_id: number;
  remark: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AccountWithGroup extends AccountRow {
  group_name: string | null;
  group_color: string | null;
}

export interface GraphTokenResponse {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

export interface GraphEmail {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  receivedDateTime: string;
  isRead: boolean;
  hasAttachments: boolean;
  bodyPreview: string;
}

export interface GraphEmailDetail extends GraphEmail {
  body: {
    contentType: string;
    content: string;
  };
  toRecipients: Array<{ emailAddress: { name: string; address: string } }>;
  ccRecipients: Array<{ emailAddress: { name: string; address: string } }>;
}

export interface GraphMessagesResponse {
  value: GraphEmail[];
  "@odata.count"?: number;
  "@odata.nextLink"?: string;
}
