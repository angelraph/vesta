"""Records the Vesta demo on two virtual phones against the live app.

Every action is real: passkeys (a virtual authenticator with PRF), Monad
testnet transactions, Agora settlement, the steward. The script logs when
each scene starts on each phone so compose.py can cut and narrate it.

    PYTHONIOENCODING=utf-8 python video/record.py
"""
import asyncio
import json
import re
import os
import secrets
import time

from playwright.async_api import Page, async_playwright

URL = os.environ.get("VESTA_URL", "https://vesta-pi-neon.vercel.app")
OUT = "video/out/raw"
PHONE = {"width": 390, "height": 844}
MAMA = "0x" + secrets.token_hex(20)  # a fresh address for Mama in Lagos

marks: list[dict] = []
t0: dict[str, float] = {}


def mark(who: str, scene: str):
    t = round(time.monotonic() - t0[who], 2)
    marks.append({"phone": who, "scene": scene, "t": t})
    print(f"[{who} {t:7.2f}s] {scene}", flush=True)


async def phone(browser, who: str):
    ctx = await browser.new_context(
        viewport=PHONE,
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
        record_video_dir=f"{OUT}/{who}",
        record_video_size={"width": PHONE["width"] * 2, "height": PHONE["height"] * 2},  # page fills the top-left quarter; compose.py crops it
        permissions=["clipboard-read", "clipboard-write"],
        locale="en-GB",
        timezone_id="Europe/London",
    )
    page = await ctx.new_page()
    t0[who] = time.monotonic()
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
    page.on("console", lambda m: print(f"  ({who} console {m.type}) {m.text[:300]}") if m.type == "error" and "hmr" not in m.text else None)
    return ctx, page


async def type_slow(page: Page, locator, text: str):
    await locator.click()
    await locator.press_sequentially(text, delay=70)


async def scroll(page: Page, total: int, step: int = 120, pause: int = 140):
    for _ in range(total // step):
        await page.mouse.wheel(0, step)
        await page.wait_for_timeout(pause)


async def nav(page: Page, path: str):
    """Moves around with the app's own bottom tabs; a reload would lock the session."""
    await page.locator(f'nav a[href="{path}"]').last.click()
    await page.wait_for_url(f"**{path}", timeout=30_000)
    await page.wait_for_timeout(900)


async def tap(page: Page, locator, settle: int = 600):
    await locator.scroll_into_view_if_needed()
    await page.wait_for_timeout(250)
    await locator.click()
    await page.wait_for_timeout(settle)


async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        a_ctx, a = await phone(browser, "amina")

        # 1. Landing
        mark("amina", "landing")
        await a.goto(URL)
        await a.wait_for_timeout(3500)
        await a.mouse.move(195, 420)
        await scroll(a, 3600, 90, 160)
        await a.wait_for_timeout(1500)
        await a.evaluate("window.scrollTo({top: 0, behavior: 'smooth'})")
        await a.wait_for_timeout(1500)

        # 2. Sign up with a passkey
        mark("amina", "signup")
        await tap(a, a.get_by_role("button", name="Get started"))
        await type_slow(a, a.get_by_label("Your name"), "Amina")
        await a.wait_for_timeout(500)
        await tap(a, a.get_by_role("button", name="Create with passkey"), 200)
        await a.wait_for_url("**/home", timeout=90_000)
        await a.get_by_text("$100", exact=False).first.wait_for(timeout=90_000)
        await a.get_by_text("Amina").first.wait_for(timeout=60_000)
        mark("amina", "home")
        await a.wait_for_timeout(2500)

        # 3. Set up the house
        mark("amina", "house")
        await tap(a, a.get_by_role("button", name="Set up a house").first)
        await a.wait_for_url("**/house/new")
        await type_slow(a, a.get_by_label("House name"), "12 Amhurst Road")
        await type_slow(a, a.get_by_label("Monthly rent for the whole house"), "60")
        await tap(a, a.get_by_role("button", name="I collect the rent myself (use my address)"))
        await tap(a, a.get_by_role("button", name="Create house"), 200)
        await a.wait_for_url("**/house", timeout=90_000)
        await a.get_by_text("Invite a housemate").first.wait_for(timeout=60_000)
        await a.wait_for_timeout(1500)
        mark("amina", "invite")
        await tap(a, a.get_by_text("Invite a housemate").first, 1200)
        invite = await a.evaluate("navigator.clipboard.readText()")
        print("invite:", invite[:60] + "...")
        assert "/join#" in invite, invite

        # 4. Tobi moves in from the invite
        t_ctx, t = await phone(browser, "tobi")
        mark("tobi", "join")
        await t.goto(invite)
        await t.get_by_text("You're invited").wait_for(timeout=60_000)
        await t.wait_for_timeout(1800)
        await type_slow(t, t.get_by_label("Your name"), "Tobi")
        await tap(t, t.get_by_role("button", name="Move in with a passkey"), 200)
        await t.wait_for_url("**/home", timeout=120_000)
        await t.get_by_text("12 Amhurst Road").first.wait_for(timeout=90_000)
        await t.get_by_role("button", name="Pay your share").wait_for(timeout=90_000)
        mark("tobi", "home")
        await t.wait_for_timeout(2000)

        # 5. Tobi pays his share
        mark("tobi", "pay")
        await tap(t, t.get_by_role("button", name="Pay your share"), 200)
        await t.get_by_text(re.compile("paid up this month")).wait_for(timeout=120_000)
        await t.wait_for_timeout(2500)

        # Amina pays hers too, and the pot fills
        await nav(a, "/home")
        await a.get_by_role("button", name="Pay your share").wait_for(timeout=60_000)
        mark("amina", "pay")
        await a.wait_for_timeout(1200)
        await tap(a, a.get_by_role("button", name="Pay your share"), 200)
        await a.get_by_text(re.compile("paid up this month")).wait_for(timeout=120_000)
        await a.wait_for_timeout(3000)

        # 6. Amina adds dinner to the tab
        mark("amina", "split")
        await nav(a, "/split")
        await tap(a, a.get_by_role("button", name="Add a shared cost"), 900)
        await a.locator("input[inputmode=decimal]").first.press_sequentially("64", delay=120)
        await type_slow(a, a.get_by_label("What for"), "Dinner at Mara's")
        await a.wait_for_timeout(800)
        await tap(a, a.get_by_role("button", name="Add to the tab"), 200)
        await a.get_by_role("button", name="Add to the tab").wait_for(state="hidden", timeout=90_000)
        await a.wait_for_timeout(3000)

        # 7. Tobi settles up
        mark("tobi", "settle")
        await nav(t, "/split")
        await t.get_by_role("button", name="Pay", exact=True).wait_for(timeout=90_000)
        await t.wait_for_timeout(1500)
        await tap(t, t.get_by_role("button", name="Pay", exact=True), 200)
        await t.get_by_text("Nobody owes anybody").wait_for(timeout=90_000)
        await t.wait_for_timeout(2500)

        # 8. Amina sends money home to Mama, settled by Agora
        mark("amina", "send")
        await nav(a, "/send")
        await tap(a, a.get_by_text("New recipient").first, 900)
        await tap(a, a.get_by_role("button", name="Nigeria"))
        await type_slow(a, a.get_by_label("Name"), "Mama")
        await a.get_by_label("Their Vesta address").fill(MAMA)
        await a.wait_for_timeout(600)
        await tap(a, a.get_by_role("button", name="Save and continue"), 1200)
        await a.locator("input[inputmode=decimal]").first.press_sequentially("50", delay=150)
        await a.wait_for_timeout(1500)
        await tap(a, a.get_by_role("button", name="Continue"), 1500)
        await a.wait_for_timeout(1500)
        await tap(a, a.get_by_role("button", name="Confirm and send"), 200)
        await a.get_by_role("button", name="View receipt").wait_for(timeout=120_000)
        mark("amina", "sent")
        await a.wait_for_timeout(3000)
        await tap(a, a.get_by_role("button", name="View receipt"), 200)
        await a.get_by_text("Settled by").wait_for(timeout=60_000)
        mark("amina", "receipt")
        await a.wait_for_timeout(2500)
        await scroll(a, 360, 60, 120)
        await a.wait_for_timeout(2000)

        # 9. The steward (one question)
        mark("amina", "steward")
        await a.go_back()  # back into the app from the public receipt page
        await a.wait_for_timeout(1200)
        await nav(a, "/home")
        await tap(a, a.get_by_role("link", name="Steward").first, 1200)
        await a.wait_for_timeout(2000)
        await tap(a, a.get_by_text("Am I square with everyone?").first, 200)
        await a.wait_for_function(
            "() => document.querySelectorAll('main p, main div').length > 0 && !document.body.innerText.includes('Thinking')",
            timeout=90_000,
        )
        await a.wait_for_timeout(9000)
        mark("amina", "steward-done")

        # 10. Stateless: wipe the phone, unlock with the passkey, everything is back
        mark("amina", "wipe")
        await a.go_back()  # the steward screen has a back arrow, not the tabs
        await a.wait_for_url("**/home", timeout=30_000)
        await a.wait_for_timeout(2000)
        await a.evaluate("localStorage.clear(); sessionStorage.clear();")
        await a.goto(URL)
        await a.wait_for_timeout(2500)
        await tap(a, a.get_by_role("button", name="I already have Vesta"), 200)
        await a.wait_for_url("**/home", timeout=60_000)
        await a.get_by_text("12 Amhurst Road").first.wait_for(timeout=60_000)
        mark("amina", "restored")
        await a.wait_for_timeout(4000)
        mark("amina", "end")
        mark("tobi", "end")

        a_video = await a.video.path()
        t_video = await t.video.path()
        await a_ctx.close()
        await t_ctx.close()
        await browser.close()

    with open(f"{OUT}/marks.json", "w") as f:
        json.dump({"amina": a_video, "tobi": t_video, "mama": MAMA, "marks": marks}, f, indent=1)
    print("saved", a_video, t_video)


asyncio.run(main())
