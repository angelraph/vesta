"""Can a virtual passkey (with PRF) sign up on Vesta? Records a short clip."""
import asyncio
from playwright.async_api import async_playwright

import os
URL = os.environ.get("VESTA_URL", "https://vesta-pi-neon.vercel.app")


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
            record_video_dir="video/out/probe",
            record_video_size={"width": 780, "height": 1688},
        )
        page = await ctx.new_page()
        cdp = await ctx.new_cdp_session(page)
        await cdp.send("WebAuthn.enable")
        await cdp.send(
            "WebAuthn.addVirtualAuthenticator",
            {
                "options": {
                    "protocol": "ctap2",
                    "ctap2Version": "ctap2_1",
                    "transport": "internal",
                    "hasResidentKey": True,
                    "hasUserVerification": True,
                    "isUserVerified": True,
                    "automaticPresenceSimulation": True,
                    "hasPrf": True,
                }
            },
        )
        page.on("console", lambda m: print("console:", m.type, m.text[:2500]) if m.type in ("error", "warning") else None)
        await page.goto(URL)
        await page.wait_for_timeout(2500)
        await page.get_by_role("button", name="Get started").click()
        await page.get_by_label("Your name").fill("Amina")
        await page.get_by_role("button", name="Create with passkey").click()
        try:
            await page.wait_for_url("**/home", timeout=60000)
            print("SIGNED UP, on", page.url)
            await page.wait_for_timeout(20000)
            print((await page.locator("main").inner_text())[:300])
        except Exception as e:
            print("did not reach home:", e)
            print(await page.locator("main").inner_text())
        await page.screenshot(path="video/out/probe.png")
        await ctx.close()
        await browser.close()


asyncio.run(main())
