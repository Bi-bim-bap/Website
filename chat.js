/*
   Tiny "chatbot" for the Q&A pages. No server, no API, no external service.

   It reads the questions and answers already written in the page
   (<details class="qa-item">), scores them against what the visitor typed,
   and replies with the closest answer.

   Tip: to help a question get found, add extra words to it:
   <details class="qa-item" data-keywords="hobby free time sport">
*/

(function () {

    // ---------- Matching logic (pure functions) ----------

    // Very common words that should never decide a match (English and French)
    const STOP = new Set((
        "the is are was were you your yours what how why who when where which do does did to of an and in on " +
        "for with about me my can tell would any there this that have has it its be like name " +
        "le la les de du des un une est et en que qui quel quelle quels quelles vous votre vos pour par sur " +
        "avec dans je ma mon tu ton avez faites quoi ce cet cette au aux ne pas comment pourquoi nom"
    ).split(" "));

    // Common Chinese question words and particles, removed before matching
    const CJK_STOP = /為什麼|什麼|怎麼樣|怎麼|如何|哪個|哪些|哪裡|嗎|呢|吧|的|是|你|我|有|最|了|在/g;

    function normalise(text) {
        return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    // Turns text into a set of searchable tokens.
    // Latin text: words (accents removed, trailing "s" removed).
    // Chinese: single characters and pairs of characters.
    function tokens(text) {
        const out = new Set();
        const clean = normalise(text);

        (clean.match(/[a-z0-9]+/g) || []).forEach(function (word) {
            if (STOP.has(word)) return;
            if (word.length > 3 && word.endsWith("s")) word = word.slice(0, -1);
            if (word.length >= 2) out.add(word);
        });

        (text.replace(CJK_STOP, " ").match(/[\u3400-\u9fff]+/g) || []).forEach(function (run) {
            for (let i = 0; i < run.length; i++) {
                out.add(run[i]);
                if (i < run.length - 1) out.add(run.slice(i, i + 2));
            }
        });

        return out;
    }

    // entries: [{ question, answer, keywords }]
    function buildIndex(entries) {
        const docs = entries.map(function (e) {
            return {
                q: tokens(e.question + " " + (e.keywords || "")),
                a: tokens(e.answer)
            };
        });

        const df = new Map();
        docs.forEach(function (d) {
            new Set([...d.q, ...d.a]).forEach(function (t) {
                df.set(t, (df.get(t) || 0) + 1);
            });
        });

        return { docs: docs, df: df, n: docs.length };
    }

    // Returns the index of the best entry, or -1 if nothing matches well enough.
    function findBest(index, query) {
        const qTokens = tokens(query);
        // Words that appear in many entries ("what", "your", "you"...) are ignored
        const tooCommon = Math.max(2, Math.floor(index.n * 0.25));

        let best = -1;
        let bestScore = 0;

        index.docs.forEach(function (d, i) {
            let score = 0;
            qTokens.forEach(function (t) {
                const count = index.df.get(t);
                if (!count || count > tooCommon) return;
                let weight = Math.log(index.n / count);
                if (t.length === 1) weight *= 0.6;          // single Chinese characters count less
                if (d.q.has(t)) score += weight * 2;       // match in question counts double
                else if (d.a.has(t)) score += weight;
            });
            if (score > bestScore) { bestScore = score; best = i; }
        });

        return bestScore >= 1.5 ? best : -1;
    }

    // Allows testing outside the browser
    if (typeof module !== "undefined" && module.exports) {
        module.exports = { buildIndex: buildIndex, findBest: findBest };
    }
    if (typeof document === "undefined") return;


    // ---------- Chat interface ----------

    const box = document.getElementById("qaChat");
    if (!box) return;

    const items = Array.prototype.slice.call(document.querySelectorAll(".qa-item"));
    const log = document.getElementById("chatLog");
    const form = document.getElementById("chatForm");
    const input = document.getElementById("chatInput");

    const entries = items.map(function (item) {
        const summary = item.querySelector("summary");
        const answer = Array.prototype.slice.call(item.children)
            .filter(function (el) { return el !== summary; })
            .map(function (el) { return el.textContent; })
            .join(" ");
        return {
            question: summary.textContent,
            answer: answer,
            keywords: item.getAttribute("data-keywords") || ""
        };
    });

    const index = buildIndex(entries);

    function addUser(text) {
        const div = document.createElement("div");
        div.className = "msg user";
        div.textContent = text;            // textContent: never inject visitor text as HTML
        log.appendChild(div);
        log.scrollTop = log.scrollHeight;
    }

    function addBot(itemIndex) {
        const div = document.createElement("div");
        div.className = "msg bot";

        if (itemIndex === -1) {
            div.textContent = box.getAttribute("data-nomatch");
        } else {
            const item = items[itemIndex];

            const label = document.createElement("span");
            label.className = "closest";
            label.textContent = box.getAttribute("data-closest") + " " +
                item.querySelector("summary").textContent;
            div.appendChild(label);

            // Copy the answer (paragraphs and link buttons) from the list below
            Array.prototype.slice.call(item.children).forEach(function (el) {
                if (el.tagName !== "SUMMARY") div.appendChild(el.cloneNode(true));
            });
        }

        log.appendChild(div);
        log.scrollTop = log.scrollHeight;
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        const text = input.value.trim();
        if (!text) return;

        addUser(text);
        input.value = "";

        setTimeout(function () {
            addBot(findBest(index, text));
        }, 300);
    });

})();
