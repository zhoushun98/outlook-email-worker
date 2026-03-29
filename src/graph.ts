import { GraphTokenResponse, GraphEmail, GraphEmailDetail, GraphMessagesResponse } from "./types";

const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0/me";

export async function getAccessToken(
  clientId: string,
  refreshToken: string
): Promise<{ accessToken: string | null; newRefreshToken?: string; error?: string }> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: "https://graph.microsoft.com/.default",
      }),
    });

    const data = (await res.json()) as GraphTokenResponse;

    if (!res.ok) {
      if (data.error_description?.includes("User account is found to be in service abuse mode")) {
        return { accessToken: null, error: "账号被封禁" };
      }
      return { accessToken: null, error: data.error_description || `Token refresh failed: ${res.status}` };
    }

    return {
      accessToken: data.access_token ?? null,
      newRefreshToken: data.refresh_token,
    };
  } catch (e) {
    return { accessToken: null, error: `Token request exception: ${e}` };
  }
}

export async function getInboxMessages(
  clientId: string,
  refreshToken: string,
  top = 20
): Promise<{ emails: GraphEmail[] | null; error?: string }> {
  const tokenResult = await getAccessToken(clientId, refreshToken);
  if (!tokenResult.accessToken) {
    return { emails: null, error: tokenResult.error };
  }

  try {
    const params = new URLSearchParams({
      $top: String(top),
      $select: "id,subject,from,receivedDateTime,isRead,hasAttachments,bodyPreview",
      $orderby: "receivedDateTime desc",
    });

    const res = await fetch(`${GRAPH_BASE}/mailFolders/inbox/messages?${params}`, {
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        Prefer: "outlook.body-content-type='text'",
      },
    });

    if (!res.ok) {
      return { emails: null, error: `Graph API error: ${res.status}` };
    }

    const data = (await res.json()) as GraphMessagesResponse;
    return { emails: data.value ?? [] };
  } catch (e) {
    return { emails: null, error: `Graph API exception: ${e}` };
  }
}

export async function getMessageDetail(
  clientId: string,
  refreshToken: string,
  messageId: string
): Promise<{ email: GraphEmailDetail | null; error?: string }> {
  const tokenResult = await getAccessToken(clientId, refreshToken);
  if (!tokenResult.accessToken) {
    return { email: null, error: tokenResult.error };
  }

  try {
    const params = new URLSearchParams({
      $select: "id,subject,from,toRecipients,ccRecipients,receivedDateTime,isRead,hasAttachments,body,bodyPreview",
    });

    const res = await fetch(`${GRAPH_BASE}/messages/${messageId}?${params}`, {
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        Prefer: "outlook.body-content-type='html'",
      },
    });

    if (!res.ok) {
      return { email: null, error: `Graph API error: ${res.status}` };
    }

    const data = (await res.json()) as GraphEmailDetail;
    return { email: data };
  } catch (e) {
    return { email: null, error: `Graph API exception: ${e}` };
  }
}
