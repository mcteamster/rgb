import { DiscordSDK, patchUrlMappings } from "@discord/embedded-app-sdk";
import { ENDPOINTS } from "../constants/regions";

// Initialise Discord Integration
export let discordSdk: DiscordSDK;
export function initaliseDiscord() {
  const params = new URLSearchParams(window.location.href);
  console.log('Discord init: Checking for frame_id parameter');

  if (params.get('frame_id')) {
    console.log('Discord init: Running inside Discord, initializing SDK');
    // Patch Service URLs for CSP compatibiltiy with the Discord proxy
    const urlPatches = [
      {
        prefix: '/api',
        target: 'api.ohnomer.com'
      },
      {
        prefix: '/rest',
        target: 'rest.rgb.mcteamster.com'
      },
      ...Object.keys(ENDPOINTS).map((endpoint) => {
        return {
          prefix: `/region/${endpoint.toLowerCase()}`,
          target: ENDPOINTS[endpoint as keyof typeof ENDPOINTS].replace('wss://', '')
        }
      }),
      {
        prefix: '/bing',
        target: 'c.bing.com'
      },
      {
        prefix: '/clarity/{subdomain}',
        target: '{subdomain}.clarity.ms'
      },
    ]
    console.log('Discord init: Applying URL patches:', urlPatches);
    patchUrlMappings(urlPatches, { patchSrcAttributes: true });

    discordSdk = new DiscordSDK("1458048532639514800");
    (async () => {
      // Purge local state on new sessions
      if (!localStorage.getItem('instance_id') || (localStorage.getItem('instance_id') != discordSdk.instanceId)) {
        console.log('Discord init: Purging old session data');
        localStorage.removeItem("rgb-game-session")
      }
      console.log('Discord init: Setting instance ID:', discordSdk.instanceId);
      localStorage.setItem('instance_id', discordSdk.instanceId)

      await discordSdk.ready();
    })().then(async () => {
      console.info("Discord SDK is ready");
    }).catch((error) => {
      console.error("Discord SDK initialization failed:", error);
    });
    return true
  } else {
    console.debug("Not running inside Discord");
    return false
  }
}
