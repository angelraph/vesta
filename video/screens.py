"""Takes real, high-resolution screenshots of every Vesta screen on the live app.

Two virtual phones (passkeys with PRF) go through the real flow on Monad
testnet; each step is captured at 3x for the README product tour.
"""
import asyncio
import os
import re
import secrets

from playwright.async_api import async_playwright

URL = os.environ.get("VESTA_URL", "https://vesta-pi-neon.vercel.app")
OUT = "media/screens"
PHONE = {"width": 390, "height": 844}


async def phone(browser):
    ctx = await browser.new_context(viewport=PHONE, device_scale_factor=3, is_mobile=True, has_touch=True,
                                    permissions=["clipboard-read", "clipboard-write"], locale="en-GB", timezone_id="Europe/London")
    page = await ctx.new_page()
    cdp = await ctx.new_cdp_session(page)
    await cdp.send("WebAuthn.enable")
    await cdp.send("WebAuthn.addVirtualAuthenticator", {"options": {
        "protocol": "ctap2", "ctap2Version": "ctap2_1", "transport": "internal", "hasResidentKey": True,
        "hasUserVerification": True, "isUserVerified": True, "automaticPresenceSimulation": True, "hasPrf": True}})
    return ctx, page


async def shot(page, name, wait=1800):
    await page.wait_for_timeout(wait)  # let entrance animations settle
    await page.screenshot(path=f"{OUT}/{name}.png")
    print("shot", name, flush=True)


async def to_home(page, who):
    try:
        await page.wait_for_url("**/home", timeout=120_000)
    except Exception:
        await page.screenshot(path=f"video/out/stuck-{who}.png")
        print(f"STUCK {who}:", (await page.locator("body").inner_text())[:600], flush=True)
        raise


async def nav(page, path):
    await page.locator(f'nav a[href="{path}"]').last.click()
    await page.wait_for_url(f"**{path}", timeout=30_000)


async def type_in(page, loc, text):
    await loc.click()
    await loc.press_sequentially(text, delay=40)


async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        _, a = await phone(browser)

        await a.goto(URL)
        await shot(a, "01-landing", 3500)
        await a.mouse.wheel(0, 900)
        await shot(a, "02-landing-pot", 3500)
        await a.mouse.wheel(0, 950)
        await shot(a, "03-landing-send", 3500)
        await a.evaluate("window.scrollTo(0, 0)")

        await a.get_by_role("button", name="Get started").click()
        await type_in(a, a.get_by_label("Your name"), "Amina")
        await shot(a, "04-signup", 600)
        await a.get_by_role("button", name="Create with passkey").click()
        await a.wait_for_url("**/home", timeout=90_000)
        await a.get_by_text("$100", exact=False).first.wait_for(timeout=90_000)
        await a.get_by_text("Amina").first.wait_for(timeout=60_000)
        await shot(a, "05-home-new", 2500)

        await a.get_by_role("button", name="Set up a house").first.click()
        await a.wait_for_url("**/house/new")
        await type_in(a, a.get_by_label("House name"), "12 Amhurst Road")
        await type_in(a, a.get_by_label("Monthly rent for the whole house"), "90")
        await a.get_by_role("button", name="I collect the rent myself (use my address)").click()
        await shot(a, "06-house-new", 800)
        await a.get_by_role("button", name="Create house").click()
        await a.wait_for_url("**/house", timeout=90_000)
        await a.get_by_text("Invite a housemate").first.click()
        await a.wait_for_timeout(1200)
        invite = await a.evaluate("navigator.clipboard.readText()")

        _, t = await phone(browser)
        await t.goto(invite)
        await t.get_by_text("You're invited").wait_for(timeout=60_000)
        await type_in(t, t.get_by_label("Your name"), "Tobi")
        await shot(t, "07-invite", 800)
        t.on("console", lambda msg: print("  tobi console:", msg.text[:300]) if msg.type == "error" else None)
        await t.get_by_role("button", name="Move in with a passkey").click()
        await to_home(t, "tobi")
        await t.get_by_role("button", name=re.compile("Pay your share")).wait_for(timeout=90_000)
        await t.get_by_role("button", name=re.compile("Pay your share")).click()
        await t.get_by_text(re.compile("paid up this month")).wait_for(timeout=120_000)

        # A third housemate who hasn't paid yet, so the steward has someone to remind.
        _, m = await phone(browser)
        await m.goto(invite)
        await m.get_by_text("You're invited").wait_for(timeout=60_000)
        await type_in(m, m.get_by_label("Your name"), "Mara")
        await m.get_by_role("button", name="Move in with a passkey").click()
        await to_home(m, "mara")
        await m.get_by_text("12 Amhurst Road").first.wait_for(timeout=90_000)

        await nav(a, "/home")
        await a.get_by_role("button", name=re.compile("Pay your share")).wait_for(timeout=60_000)
        await a.get_by_role("button", name=re.compile("Pay your share")).click()
        await a.get_by_text(re.compile("paid up this month")).wait_for(timeout=120_000)
        await a.wait_for_timeout(5000)
        await shot(a, "08-home-rent", 2500)

        await nav(a, "/house")
        await shot(a, "09-house", 2500)

        await nav(a, "/split")
        await a.get_by_role("button", name="Add a shared cost").click()
        await a.wait_for_timeout(900)
        await a.locator("input[inputmode=decimal]").first.press_sequentially("72", delay=60)
        await type_in(a, a.get_by_label("What for"), "Dinner at Mara's")
        await shot(a, "10-split-add", 800)
        await a.get_by_role("button", name="Add to the tab").click()
        await a.get_by_role("button", name="Add to the tab").wait_for(state="hidden", timeout=90_000)
        await nav(t, "/split")
        await t.get_by_role("button", name="Pay", exact=True).wait_for(timeout=90_000)
        await shot(t, "11-split-settle", 1500)

        await nav(a, "/send")
        await a.get_by_text("New recipient").first.click()
        await a.wait_for_timeout(900)
        await a.get_by_role("button", name="Nigeria").click()
        await type_in(a, a.get_by_label("Name"), "Mama")
        await a.get_by_label("Their Vesta address").fill("0x" + secrets.token_hex(20))
        await a.get_by_role("button", name="Save and continue").click()
        await a.wait_for_timeout(1200)
        await a.locator("input[inputmode=decimal]").first.press_sequentially("50", delay=80)
        await a.wait_for_timeout(1500)
        await shot(a, "12-send-amount", 1200)
        await a.get_by_role("button", name="Continue").click()
        await shot(a, "13-send-review", 1800)
        await a.get_by_role("button", name="Confirm and send").click()
        await a.get_by_role("button", name="View receipt").wait_for(timeout=120_000)
        await shot(a, "14-send-done", 1800)
        await a.get_by_role("button", name="View receipt").click()
        await a.get_by_text("Settled by").wait_for(timeout=60_000)
        await shot(a, "15-receipt", 2000)
        await a.go_back()
        await a.wait_for_timeout(1500)

        await nav(a, "/home")
        await a.get_by_role("link", name="Steward").first.click()
        await a.wait_for_timeout(1500)
        await a.get_by_text("Who still owes rent this month?").first.click()
        await a.get_by_text(re.compile("Message for|drafted", re.I)).first.wait_for(timeout=90_000)
        await shot(a, "16-steward", 2500)

        await a.go_back()
        await a.wait_for_url("**/home", timeout=30_000)
        await a.wait_for_timeout(2500)
        await shot(a, "17-home-activity", 1500)

        await browser.close()


asyncio.run(main())
