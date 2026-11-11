// agent/channels/eve.ts: Lets local development in without a login, and requires a username and password everywhere else.
import { eveChannel } from "eve/channels/eve";
import { httpBasic, localDev } from "eve/channels/auth";

export default eveChannel({
  auth: [
    localDev(),
    httpBasic({
      username: process.env.EVE_USERNAME!,
      password: process.env.EVE_PASSWORD!,
    }),
  ],
});