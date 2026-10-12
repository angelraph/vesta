"""End-to-end check of cash out: Amina sends Mama money home, Mama converts it back to dollars.

Two virtual phones with PRF passkeys, real transactions on Monad testnet.
Run against a local dev server: VESTA_URL=http://localhost:3000 python video/cashout_test.py
"""
import asyncio
import os
import re

from playwright.async_api import async_playwright

URL = os.environ.get("VESTA_URL", "http://localhost:3000")
OUT = "video/out"
PHONE = {"width": 390, "height": 844}


async def phone(browser, who):
    ctx = await browser.new_context(viewport=PHONE, device_scale_factor=2, is_mobile=True, has_touch=True,
                                    permissions=["clipboard-read", "clipboard-write"], locale="en-GB")
    page = await ctx.new_page()
    page.on("console", lambda m: print(f"  {who} console:", m.text[:300]) if m.type == "error" else None)
    cdp = await ctx.new_cdp_session(page)
    await cdp.send("WebAuthn.enable")
    await cdp.send("WebAuthn.addVirtualAuthenticator", {"options": {
        "protocol": "ctap2", "ctap2Version": "ctap2_1", "transport": "internal", "hasResidentKey": True,
        "hasUserVerification": True, "isUserVerified": True, "automaticPresenceSimulation": True, "hasPrf": True}})
    return page


async def go(page, path):
    # In-app navigation: a full reload would lock the signing session.
    await page.locator(f'a[href="{path}"]').first.click(force=True)
    await page.wait_for_url(f"**{path}", timeout=30_000)


async def sign_up(page, name):
    await page.goto(URL)
    await page.get_by_role("button", name="Get started").click()
    await page.get_by_label("Your name").fill(name)
    await page.get_by_role("button", name="Create with passkey").click()
    await page.wait_for_url("**/home", timeout=120_000)
    await page.get_by_text("$100", exact=False).first.wait_for(timeout=120_000)
    print(name, "signed up", flush=True)


async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        mama = await phone(browser, "mama")
        await sign_up(mama, "Mama")
        await go(mama, "/topup")
        await mama.get_by_role("button", name=re.compile(r"^0x")).click()
        await mama.wait_for_timeout(600)
        address = await mama.evaluate("navigator.clipboard.readText()")
        print("mama address", address, flush=True)

        amina = await phone(browser, "amina")
        await sign_up(amina, "Amina")
        await go(amina, "/send")
        await amina.get_by_text("New recipient").first.click()
        await amina.wait_for_timeout(900)
        await amina.get_by_label("Name").fill("Mama")
        await amina.get_by_label("Their Vesta address").fill(address)
        await amina.get_by_role("button", name="Save and continue").click()
        await amina.locator("input[inputmode=decimal]").first.wait_for(timeout=120_000)
        await amina.locator("input[inputmode=decimal]").first.press_sequentially("10", delay=80)
        await amina.wait_for_timeout(1500)
        await amina.get_by_role("button", name="Continue").click()
        await amina.get_by_role("button", name="Confirm and send").click()
        await amina.get_by_text("$90", exact=False).first.wait_for(timeout=120_000)
        print("sent home", flush=True)

        await go(mama, "/home")
        link = mama.get_by_role("link", name=re.compile("received from abroad"))
        await link.wait_for(timeout=120_000)
        await mama.wait_for_timeout(1500)
        await mama.screenshot(path=f"{OUT}/cashout-1-home.png")
        await link.click()
        await mama.wait_for_url("**/cashout")
        convert = mama.get_by_role("button", name=re.compile(r"^Convert \$"))
        await convert.wait_for(timeout=30_000)
        await mama.wait_for_timeout(1500)
        await mama.screenshot(path=f"{OUT}/cashout-2-before.png")
        await convert.click()
        try:
            await mama.get_by_text(re.compile("is in your balance")).wait_for(timeout=180_000)
        except Exception:
            await mama.screenshot(path=f"{OUT}/cashout-stuck.png")
            print("STUCK:", (await mama.locator("main").inner_text())[:800], flush=True)
            raise
        await mama.wait_for_timeout(2000)
        await mama.screenshot(path=f"{OUT}/cashout-3-done.png")
        href = await mama.get_by_role("link", name="Check it on the explorer").get_attribute("href")
        print("converted", href, flush=True)

        await go(mama, "/home")
        await mama.wait_for_timeout(5000)
        print("mama home:", re.sub(r"\s+", " ", (await mama.locator("main").inner_text()))[:200], flush=True)
        await browser.close()


asyncio.run(main())
