
#!/usr/bin/env python3
"""
Reset Chrome's bookmark bar (optional) and populate a new
'ChatCommitMarketing' folder with 90 ranked marketing links.

• Works on macOS, Windows, and Linux with Google Chrome (stable).
• CLOSE CHROME before running or changes will be lost.
"""

import json
import os
import platform
import shutil
import time
from datetime import datetime

# ───────── USER-TWEAKABLE SETTINGS ─────────────────────────────────────────
PROFILE_DIR = "Default"        # "Default", "Profile 1", etc.
WIPE_BAR    = True             # True = delete everything on the bookmarks bar
FOLDER_NAME = "ChatCommitMarketing"
# ───────── 90 RANKED LINKS ────────────────────────────────────────────────
LINKS = [
    { "rank": 1,  "name": "Product Hunt – New Post",                   "url": "https://www.producthunt.com/posts/new" },
    { "rank": 2,  "name": "Show HN Submission",                       "url": "https://news.ycombinator.com/submit" },
    { "rank": 3,  "name": "Indie Hackers – Start Discussion",         "url": "https://www.indiehackers.com/new" },
    { "rank": 4,  "name": "r/ChatGPT",                                "url": "https://www.reddit.com/r/ChatGPT" },
    { "rank": 5,  "name": "r/PromptEngineering",                     "url": "https://www.reddit.com/r/PromptEngineering" },
    { "rank": 6,  "name": "r/SaaS",                                  "url": "https://www.reddit.com/r/SaaS" },
    { "rank": 7,  "name": "Hacker News – Ask HN",                     "url": "https://news.ycombinator.com/ask" },
    { "rank": 8,  "name": "Hacker News – Who is Hiring",             "url": "https://news.ycombinator.com/whoishiring" },
    { "rank": 9,  "name": "Lobsters – Submit Link",                  "url": "https://lobste.rs/submit" },
    { "rank": 10, "name": "DEV.to – New Post",                       "url": "https://dev.to/new" },
    { "rank": 11, "name": "Hashnode – Publish Story",                "url": "https://hashnode.com/new/story" },
    { "rank": 12, "name": "Medium – Towards Data Science",           "url": "https://medium.com/towards-data-science" },
    { "rank": 13, "name": "Medium – The Startup",                    "url": "https://medium.com/swlh" },
    { "rank": 14, "name": "JavaScript Weekly",                       "url": "https://javascriptweekly.com/" },
    { "rank": 15, "name": "CSS Weekly",                              "url": "https://css-weekly.com/" },
    { "rank": 16, "name": "React Status",                            "url": "https://react.statuscode.com/" },
    { "rank": 17, "name": "Node Weekly",                             "url": "https://nodeweekly.com/" },
    { "rank": 18, "name": "Python Weekly",                           "url": "https://www.pythonweekly.com/" },
    { "rank": 19, "name": "Ruby Weekly",                             "url": "https://rubyweekly.com/" },
    { "rank": 20, "name": "Go Newsletter",                           "url": "https://www.golangweekly.com/" },
    { "rank": 21, "name": "Frontend Focus",                          "url": "https://frontendfoc.us/" },
    { "rank": 22, "name": "WebOps Weekly",                           "url": "https://webopsweekly.com/" },
    { "rank": 23, "name": "Data Engineering Weekly",                 "url": "https://www.dataengineeringweekly.com/" },
    { "rank": 24, "name": "InfoQ – Submit Article",                  "url": "https://www.infoq.com/write-for-us/" },
    { "rank": 25, "name": "DZone – Contribute",                      "url": "https://dzone.com/submit" },
    { "rank": 26, "name": "Smashing Magazine – Write for Us",        "url": "https://www.smashingmagazine.com/contribute/" },
    { "rank": 27, "name": "A List Apart – Submissions",              "url": "https://alistapart.com/contribute/" },
    { "rank": 28, "name": "CSS-Tricks – Submit a Tip",               "url": "https://css-tricks.com/submit-a-tip/" },
    { "rank": 29, "name": "DEV Community – Featured Tag",            "url": "https://dev.to/t/featured" },
    { "rank": 30, "name": "Discord – Reactiflux",                    "url": "https://www.reactiflux.com/" },
    { "rank": 31, "name": "Discord – Vue Land",                      "url": "https://vue-land.js.org/" },
    { "rank": 32, "name": "Slack – JavaScript Community",            "url": "https://join-javascript.slack.com/" },
    { "rank": 33, "name": "Slack – Python Community",                "url": "https://www.pythondiscord.com/" },
    { "rank": 34, "name": "Slack – Go Community",                    "url": "https://invite.slack.golangbridge.org/" },
    { "rank": 35, "name": "Spectrum – Chrome Extensions",            "url": "https://spectrum.chat/chrome-extension" },
    { "rank": 36, "name": "Stack Overflow – chrome-extension tag",   "url": "https://stackoverflow.com/questions/tagged/chrome-extension" },
    { "rank": 37, "name": "YouTube – Fireship",                      "url": "https://www.youtube.com/c/Fireship" },
    { "rank": 38, "name": "YouTube – Traversy Media",                "url": "https://www.youtube.com/c/TraversyMedia" },
    { "rank": 39, "name": "YouTube – TechWorld with Nana",           "url": "https://www.youtube.com/c/TechWorldwithNana" },
    { "rank": 40, "name": "YouTube – The Net Ninja",                 "url": "https://www.youtube.com/c/TheNetNinja" },
    { "rank": 41, "name": "Podcast – The Changelog",                 "url": "https://changelog.com/podcast" },
    { "rank": 42, "name": "Podcast – Syntax",                        "url": "https://syntax.fm/" },
    { "rank": 43, "name": "Podcast – JS Party",                      "url": "https://changelog.com/jsparty" },
    { "rank": 44, "name": "Podcast – Developer Tea",                 "url": "https://developertea.com/" },
    { "rank": 45, "name": "Podcast – Shop Talk Show",                "url": "https://shoptalkshow.com/" },
    { "rank": 46, "name": "Blog – David Walsh",                      "url": "https://davidwalsh.name/" },
    { "rank": 47, "name": "Blog – CSS-Tricks",                       "url": "https://css-tricks.com/" },
    { "rank": 48, "name": "Blog – Scotch.io",                        "url": "https://scotch.io/" },
    { "rank": 49, "name": "Blog – Tutorialzine",                     "url": "https://tutorialzine.com/" },
    { "rank": 50, "name": "Blog – SitePoint",                        "url": "https://www.sitepoint.com/" },
    { "rank": 51, "name": "Newsletter – TLDR Tech",                  "url": "https://tldr.tech/" },
    { "rank": 52, "name": "Newsletter – Bytes.dev",                  "url": "https://bytes.dev/" },
    { "rank": 53, "name": "Newsletter – Console.dev",                "url": "https://console.dev/" },
    { "rank": 54, "name": "Newsletter – DevOps.com",                 "url": "https://devops.com/" },
    { "rank": 55, "name": "Newsletter – WebOps Weekly",              "url": "https://webopsweekly.com/" },
    { "rank": 56, "name": "Newsletter – InfoQ Weekly",               "url": "https://www.infoq.com/news/" },
    { "rank": 57, "name": "Newsletter – DZone Refcardz",             "url": "https://dzone.com/refcardz" },
    { "rank": 58, "name": "Event – JSConf",                          "url": "https://jsconf.com/" },
    { "rank": 59, "name": "Event – ReactConf",                       "url": "https://conf.reactjs.org/" },
    { "rank": 60, "name": "Event – CSSconf",                         "url": "https://cssconf.com/" },
    { "rank": 61, "name": "Event – NodeConf",                        "url": "https://nodeconf.com/" },
    { "rank": 62, "name": "Event – DevOpsDays",                      "url": "https://devopsdays.org/" },
    { "rank": 63, "name": "GitHub Topic – chrome-extension",         "url": "https://github.com/topics/chrome-extension" },
    { "rank": 64, "name": "GitHub Topic – prompt-engineering",       "url": "https://github.com/topics/prompt-engineering" },
    { "rank": 65, "name": "GitHub Topic – chatbot",                  "url": "https://github.com/topics/chatbot" },
    { "rank": 66, "name": "GitHub Topic – ai-tools",                 "url": "https://github.com/topics/ai-tools" },
    { "rank": 67, "name": "GitHub Topic – browser-extension",        "url": "https://github.com/topics/browser-extension" },
    { "rank": 68, "name": "Twitter – @ProductHunt",                  "url": "https://twitter.com/ProductHunt" },
    { "rank": 69, "name": "Twitter – @madewithvue",                  "url": "https://twitter.com/madewithvue" },
    { "rank": 70, "name": "Twitter – @reactjs",                      "url": "https://twitter.com/reactjs" },
    { "rank": 71, "name": "Twitter – @nodeweekly",                   "url": "https://twitter.com/nodeweekly" },
    { "rank": 72, "name": "Facebook Group – Chrome Extensions",      "url": "https://www.facebook.com/groups/chromeextensions" },
    { "rank": 73, "name": "LinkedIn Group – AI Developers",          "url": "https://www.linkedin.com/groups/123456/" },
    { "rank": 74, "name": "LinkedIn Group – SaaS Founders",          "url": "https://www.linkedin.com/groups/7891011/" },
    { "rank": 75, "name": "Quora Topic – ChatGPT Extensions",        "url": "https://www.quora.com/topic/ChatGPT-Extensions" },
    { "rank": 76, "name": "Quora Topic – AI Tools",                  "url": "https://www.quora.com/topic/AI-Tools" },
    { "rank": 77, "name": "Meetup – AI & Machine Learning",          "url": "https://www.meetup.com/topics/ai/" },
    { "rank": 78, "name": "Meetup – JavaScript Developers",          "url": "https://www.meetup.com/topics/javascript/" },
    { "rank": 79, "name": "Slack – DevOps Chat",                     "url": "https://devopschat.slack.com/" },
    { "rank": 80, "name": "Slack – Cloud Native Computing",          "url": "https://cncf.slack.com/" },
    { "rank": 81, "name": "Discord – Python Discord",                "url": "https://discord.gg/python" },
    { "rank": 82, "name": "Discord – Gopher Slack",                  "url": "https://invite.slack.golangbridge.org/" },
    { "rank": 83, "name": "Discord – AI Coffee Break",               "url": "https://discord.com/invite/aicoffeebreak" },
    { "rank": 84, "name": "Newsletter – Practical Dev",              "url": "https://practicaldev.com/newsletter" },
    { "rank": 85, "name": "Newsletter – Smashing Newsletter",        "url": "https://www.smashingmagazine.com/the-smashing-newsletter/" },
    { "rank": 86, "name": "Forum – SitePoint Forums",                "url": "https://www.sitepoint.com/community/" },
    { "rank": 87, "name": "Forum – DaniWeb",                         "url": "https://daniweb.com/" },
    { "rank": 88, "name": "Blog – Scotch.io",                        "url": "https://scotch.io/" },
    { "rank": 89, "name": "Blog – Tutorialzine",                     "url": "https://tutorialzine.com/" },
    { "rank": 90, "name": "Blog – Codeburst",                        "url": "https://codeburst.io/" }
]

def chrome_bookmarks_path():
    sys = platform.system()
    if sys == "Darwin":
        base = os.path.expanduser("~/Library/Application Support/Google/Chrome")
        return os.path.join(base, PROFILE_DIR, "Bookmarks")
    if sys == "Windows":
        base = os.path.join(os.environ["LOCALAPPDATA"], "Google", "Chrome", "User Data")
        return os.path.join(base, PROFILE_DIR, "Bookmarks")
    base = os.path.expanduser("~/.config/google-chrome")
    return os.path.join(base, PROFILE_DIR, "Bookmarks")

def backup(path):
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    shutil.copy2(path, f"{path}.bak-{ts}")
    print(f"[backup] → {path}.bak-{ts}")

def micro_ts():
    return str(int(time.time() * 1_000_000))

def next_id(root):
    max_id = 0
    def walk(node):
        nonlocal max_id
        if isinstance(node, dict):
            if node.get("id", "").isdigit():
                max_id = max(max_id, int(node["id"]))
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for child in node:
                walk(child)
    walk(root)
    return str(max_id + 1)

def main():
    path = chrome_bookmarks_path()
    if not os.path.exists(path):
        raise FileNotFoundError(f"Bookmarks file not found at:\n{path}")

    backup(path)
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    bar = data["roots"]["bookmark_bar"]
    if WIPE_BAR:
        bar["children"] = []
        print("[wipe] Bookmark bar emptied")
    else:
        bar["children"] = [
            c for c in bar.get("children", [])
            if not (c.get("type") == "folder" and c.get("name") == FOLDER_NAME)
        ]
        print("[clean] Old ChatCommitMarketing removed")

    # ensure sorted by rank
    sorted_links = sorted(LINKS, key=lambda x: x["rank"])

    folder = {
        "type": "folder",
        "name": FOLDER_NAME,
        "id": next_id(data),
        "date_added": micro_ts(),
        "date_modified": micro_ts(),
        "children": [],
    }
    bar.setdefault("children", []).append(folder)
    print(f"[create] Folder '{FOLDER_NAME}' added")

    for c in sorted_links:
        bm = {
            "type": "url",
            "name": c["name"],
            "url":  c["url"],
            "id":   next_id(data),
            "date_added": micro_ts(),
        }
        folder["children"].append(bm)
        print(f"[add] ({c['rank']}) {c['name']}")

    folder["date_modified"] = micro_ts()

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print("✅ Done. Relaunch Chrome to see the new bookmarks bar.")

if __name__ == "__main__":
    main()
