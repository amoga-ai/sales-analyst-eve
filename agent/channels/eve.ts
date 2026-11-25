// Lets the Atomic Chat bridge sign in with its own key and marks its sessions, and keeps the existing login.
import { type AuthFn, httpBasic, localDev } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

function atomicChatAuth(): AuthFn<Request> {
  return async (request) => {
    const key = process.env.ATOMIC_CHAT_KEY;
    if (!key || request.headers.get("authorization") !== `Bearer ${key}`) return null;
    return {
      attributes: { client: "atomic-chat" },
      authenticator: "atomic-chat",
      principalId: "atomic-chat-bridge",
      principalType: "service",
    };
  };
}

export default eveChannel({
  auth: [
    atomicChatAuth(),
    httpBasic({ username: process.env.EVE_USERNAME!, password: process.env.EVE_PASSWORD! }),
    localDev(),
  ],
});