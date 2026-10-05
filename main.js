/*
   Shared behaviour for index.html, index-fr.html and index-zh.html.
   Each page defines window.I18N (translated messages) before loading this file,
   and loads the Supabase CDN script first.
*/

(function () {

    const T = window.I18N;


    // =========================================
    // SECRET PAGE: 5% chance, once per session
    // =========================================

    const secretChance = 0.05;

    try {
        if (!sessionStorage.getItem("secretChecked")) {
            sessionStorage.setItem("secretChecked", "true");

            if (Math.random() < secretChance) {
                setTimeout(() => { window.location.href = T.secretPage; }, 1500);
            }
        }
    } catch (e) { /* storage unavailable: skip */ }


    // =========================================
    // SECRET PAGE: type "louis" anywhere
    // =========================================

    let secretCode = "";
    const password = "louis";

    document.addEventListener("keydown", function (event) {
        secretCode += event.key.toLowerCase();

        if (secretCode.length > password.length) {
            secretCode = secretCode.slice(-password.length);
        }

        if (secretCode === password) {
            window.location.href = T.secretPage;
        }
    });


    // =========================================
    // HORIZONTAL TIMELINE
    // =========================================

    const timelineSection = document.querySelector(".timeline-section");
    const timeline = document.querySelector(".horizontal-timeline");

    let current = 0;   // smoothed position
    let target = 0;    // where the scroll says we should be

    function updateTarget() {
        if (window.innerWidth <= 750) {
            target = 0;
            return;
        }

        const rect = timelineSection.getBoundingClientRect();
        const scrollable = timelineSection.offsetHeight - window.innerHeight;

        let progress = -rect.top / scrollable;
        progress = Math.max(0, Math.min(1, progress / 0.9));

        const maxMove = timeline.scrollWidth - window.innerWidth;
        target = progress * Math.max(0, maxMove);
    }

    function animate() {
        current += (target - current) * 0.1;

        if (window.innerWidth <= 750) {
            timeline.style.transform = "none";
        } else {
            timeline.style.transform = `translate3d(${-current}px, 0, 0)`;
        }
        requestAnimationFrame(animate);
    }

    if (timelineSection && timeline) {
        window.addEventListener("scroll", updateTarget, { passive: true });
        window.addEventListener("resize", updateTarget);
        updateTarget();
        animate();
    }


    // =========================================
    // SUPABASE RATINGS
    // =========================================

    const SUPABASE_URL = "https://xmofjfjjskybdjpkhbhe.supabase.co";
    const SUPABASE_KEY = "sb_publishable_L-OLZvsRNi94LUBdu_rOZw_UiV03qFW";

    const { createClient } = window.supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

    const stars = document.querySelectorAll("#ratingStars button");
    const averageRating = document.getElementById("averageRating");
    const ratingCount = document.getElementById("ratingCount");
    const ratingMessage = document.getElementById("ratingMessage");


    async function loadRatings() {

        const { data, error } = await supabaseClient
            .from("website_ratings")
            .select("rating");

        if (error) {
            console.error(error);
            averageRating.textContent = "—";
            ratingCount.textContent = T.ratingsUnavailable;
            return;
        }

        if (!data || data.length === 0) {
            averageRating.textContent = "—";
            ratingCount.textContent = T.beFirst;
            return;
        }

        const total = data.reduce((sum, item) => sum + item.rating, 0);
        const average = total / data.length;

        averageRating.textContent = average.toFixed(1);
        ratingCount.textContent =
            `${data.length} ${data.length === 1 ? T.ratingOne : T.ratingMany}`;
    }


    function highlightStars(rating) {
        stars.forEach(star => {
            const value = Number(star.dataset.rating);
            star.classList.toggle("selected", value <= rating);
        });
    }


    async function submitRating(rating) {

        ratingMessage.textContent = T.saving;

        const { error } = await supabaseClient
            .from("website_ratings")
            .insert({ rating: rating });

        if (error) {
            console.error(error);
            ratingMessage.textContent = T.error;
            return;
        }

        // Remember that this browser has voted
        try {
            localStorage.setItem("websiteRated", "true");
            localStorage.setItem("websiteRating", rating);
        } catch (e) { /* storage unavailable: skip */ }

        ratingMessage.textContent = T.thanks;

        loadRatings();
    }


    stars.forEach(star => {
        star.addEventListener("click", async () => {

            let alreadyRated = false;
            try { alreadyRated = !!localStorage.getItem("websiteRated"); } catch (e) {}

            if (alreadyRated) {
                ratingMessage.textContent = T.already;
                return;
            }

            const rating = Number(star.dataset.rating);
            highlightStars(rating);
            await submitRating(rating);
        });
    });


    // Restore the visitor's previous rating
    let previousRating = null;
    try { previousRating = localStorage.getItem("websiteRating"); } catch (e) {}

    if (previousRating) {
        highlightStars(Number(previousRating));
        ratingMessage.textContent = T.thanksShort;
    }

    loadRatings();

})();
