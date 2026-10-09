"""Captures two real CRE rent-day runs on Monad testnet, line by line with timing.

1. creates a house due in two minutes with half the rent paid
2. runs the workflow (it flags the shortfall onchain)
3. pays the rest
4. once rent is due, runs it again (it pays the landlord)
"""
import json
import os
import re
import subprocess
import time

ROOT = os.path.abspath(".")
CRE = os.path.expandvars(r"%LOCALAPPDATA%\Programs\cre\cre.exe")
OUT = "video/out/cre"


def env_with_keys():
    env = dict(os.environ)
    for line in open("contracts/.env", encoding="utf8"):
        if "=" in line and not line.startswith("#"):
            k, v = line.strip().split("=", 1)
            env[k] = v.strip().strip('"')
    env["CRE_ETH_PRIVATE_KEY"] = env["DEPLOYER_PRIVATE_KEY"]
    return env


def demo(step, env):
    r = subprocess.run(
        "npx hardhat run scripts/rent-day-demo.ts --network monadTestnet",
        cwd="contracts", shell=True, capture_output=True, text=True, env={**env, "STEP": step},
    )
    print(r.stdout.strip().splitlines()[-1] if r.stdout.strip() else r.stderr[-500:])
    return r.stdout


def simulate(name, env):
    t0 = time.monotonic()
    lines = []
    p = subprocess.Popen(
        [CRE, "workflow", "simulate", "rent-day", "--target", "staging-settings", "--non-interactive", "--trigger-index", "0", "--broadcast"],
        cwd="cre", stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, env=env, text=True, encoding="utf8", errors="replace",
    )
    for raw in p.stdout:
        clean = re.sub(r"\x1b\[[0-9;?]*[a-zA-Z]", "", raw).rstrip()
        if clean.strip() and "÷" not in clean:
            lines.append({"t": round(time.monotonic() - t0, 2), "text": clean})
            print(f"  {lines[-1]['t']:6.2f}  {clean}")
    p.wait()
    with open(f"{OUT}/{name}.json", "w", encoding="utf8") as f:
        json.dump(lines, f, indent=1, ensure_ascii=False)
    hashes = re.findall(r"Written onchain: (0x[0-9a-f]{64})", "\n".join(l["text"] for l in lines))
    return hashes


def main():
    os.makedirs(OUT, exist_ok=True)
    env = env_with_keys()
    out = demo("create", env)
    due = int(re.search(r"due at (\d+)", out).group(1))
    run1 = simulate("run1", env)
    demo("topup", env)
    wait = due - time.time() + 8
    if wait > 0:
        print(f"waiting {wait:.0f}s for rent day")
        time.sleep(wait)
    run2 = simulate("run2", env)
    json.dump({"shortfall": run1, "collect": run2, "due": due}, open(f"{OUT}/hashes.json", "w"), indent=1)
    print("hashes", run1, run2)


main()
