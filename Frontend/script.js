/* =====================================================
   LIGHT RHYTHM MANAGEMENT SYSTEM
   Frontend Demo
===================================================== */


/* =====================================================
   NAVIGATION
===================================================== */

const navItems =
    document.querySelectorAll(".nav-item");

const pages =
    document.querySelectorAll(".page");

const breadcrumbText =
    document.getElementById("breadcrumbText");


function showPage(pageId) {

    pages.forEach(page => {

        page.classList.remove("active-page");

    });


    const selectedPage =
        document.getElementById(pageId);


    if (selectedPage) {

        selectedPage.classList.add("active-page");

    }


    navItems.forEach(item => {

        item.classList.remove("active");

        if (
            item.dataset.section === pageId
        ) {

            item.classList.add("active");

        }

    });


    breadcrumbText.textContent =
        pageId.toUpperCase();


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* Sidebar navigation */

navItems.forEach(item => {

    item.addEventListener("click", () => {

        showPage(
            item.dataset.section
        );

    });

});


/* Dashboard links */

document
    .querySelectorAll("[data-section-link]")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                showPage(
                    button.dataset.sectionLink
                );

            }
        );

    });


/* =====================================================
   MOBILE MENU
===================================================== */

const menuButton =
    document.getElementById("menuButton");

const sidebar =
    document.querySelector(".sidebar");


menuButton.addEventListener(
    "click",
    () => {

        sidebar.classList.toggle("open");

    }
);


/* Close mobile sidebar after selecting */

navItems.forEach(item => {

    item.addEventListener("click", () => {

        sidebar.classList.remove("open");

    });

});


/* =====================================================
   CLOCK
===================================================== */

const currentTime =
    document.getElementById("currentTime");

const bigTime =
    document.getElementById("bigTime");


const todayDate =
    document.getElementById("todayDate");


function updateClock() {

    const now = new Date();


    let hours =
        now.getHours();

    let minutes =
        now.getMinutes();

    let seconds =
        now.getSeconds();


    const formattedTime =

        String(hours).padStart(2, "0")
        + ":" +
        String(minutes).padStart(2, "0")
        + ":" +
        String(seconds).padStart(2, "0");


    currentTime.textContent =
        formattedTime;


    bigTime.textContent =

        String(hours).padStart(2, "0")
        + ":" +
        String(minutes).padStart(2, "0");


    const dateOptions = {

        weekday: "long",
        month: "long",
        day: "numeric"

    };


    todayDate.textContent =
        now.toLocaleDateString(
            "en-US",
            dateOptions
        );


    updatePeriod(hours);

    updateChartPosition(hours, minutes);

}


setInterval(updateClock, 1000);

updateClock();


/* =====================================================
   LIGHT PERIOD
===================================================== */

function updatePeriod(hour) {

    const greeting =
        document.getElementById("greeting");

    const dayPeriod =
        document.getElementById("dayPeriod");

    const currentMode =
        document.getElementById("currentMode");

    const modeMeta =
        document.getElementById("modeMeta");

    const description =
        document.getElementById(
            "currentDescription"
        );

    const symbol =
        document.getElementById(
            "lightSymbol"
        );

    const brightness =
        document.getElementById(
            "brightnessValue"
        );

    const brightnessMeta =
        document.getElementById(
            "brightnessMeta"
        );

    const fill =
        document.getElementById(
            "brightnessFill"
        );

    const orb =
        document.getElementById(
            "orbValue"
        );

    const orbTitle =
        document.getElementById(
            "brightnessModeTitle"
        );


    let mode;
    let value;
    let icon;
    let message;


    /*
       Morning
       06:00 - 10:00
    */

    if (hour >= 6 && hour < 10) {

        mode = "Morning";
        value = 60;
        icon = "☼";
        message =
            "Morning light is active";

        greeting.textContent = "morning";
        dayPeriod.textContent = "MORNING";

    }


    /*
       Day
       10:00 - 18:00
    */

    else if (hour >= 10 && hour < 18) {

        mode = "Day";
        value = 75;
        icon = "☀";
        message =
            "Bright daytime lighting";

        greeting.textContent = "day";
        dayPeriod.textContent = "DAY";

    }


    /*
       Night
       18:00 - 06:00
    */

    else {

        mode = "Night";
        value = 25;
        icon = "☾";
        message =
            "Night lighting is active";

        greeting.textContent = "evening";
        dayPeriod.textContent = "NIGHT";

    }


    currentMode.textContent =
        mode;

    modeMeta.textContent =
        mode.toUpperCase();

    description.textContent =
        message;

    symbol.textContent =
        icon;

    brightness.textContent =
        value;

    brightnessMeta.textContent =
        value;

    fill.style.width =
        value + "%";

    orb.textContent =
        value;

    orbTitle.textContent =
        mode;

}


/* =====================================================
   CHART CURRENT POSITION
===================================================== */

function updateChartPosition(
    hours,
    minutes
) {

    const position =
        document.getElementById(
            "currentPosition"
        );


    const totalMinutes =
        hours * 60 + minutes;


    const percentage =
        (totalMinutes / 1440) * 100;


    position.style.left =
        percentage + "%";

}


/* =====================================================
   SCHEDULE FILTER
===================================================== */

const scheduleFilter =
    document.getElementById(
        "scheduleFilter"
    );


if (scheduleFilter) {

    scheduleFilter.addEventListener(
        "change",
        function () {

            showToast(
                "Schedule Filter",
                `Showing ${this.value}.`
            );

        }
    );

}


/* =====================================================
   HISTORY FILTER
===================================================== */

const historyFilter =
    document.getElementById(
        "historyFilter"
    );


if (historyFilter) {

    historyFilter.addEventListener(
        "change",
        function () {

            showToast(
                "History Filter",
                `Showing ${this.value}.`
            );

        }
    );

}


/* =====================================================
   ADD SCHEDULE
===================================================== */

const addSchedule =
    document.getElementById(
        "addSchedule"
    );


if (addSchedule) {

    addSchedule.addEventListener(
        "click",
        () => {

            showToast(
                "Schedule",
                "Schedule creation interface ready."
            );

        }
    );

}


/* =====================================================
   CREATE ROUTINE
===================================================== */

const createRoutine =
    document.getElementById(
        "createRoutine"
    );


if (createRoutine) {

    createRoutine.addEventListener(
        "click",
        () => {

            showToast(
                "Light Routine",
                "Routine creation interface ready."
            );

        }
    );

}


/* =====================================================
   EDIT ROUTINE
===================================================== */

document
    .querySelectorAll(".edit-button")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                showToast(
                    "Edit Routine",
                    "Routine editing interface ready."
                );

            }
        );

    });


/* =====================================================
   BRIGHTNESS MODE INTERACTION
===================================================== */

const brightnessModes =
    document.querySelectorAll(
        ".brightness-mode"
    );


brightnessModes.forEach(mode => {

    mode.addEventListener(
        "click",
        () => {

            brightnessModes.forEach(
                item => {

                    item.classList.remove(
                        "selected"
                    );

                }
            );


            mode.classList.add(
                "selected"
            );


            const value =
                mode.querySelector(
                    ".mode-level"
                ).textContent.trim();


            const name =
                mode.querySelector(
                    ".mode-info strong"
                ).textContent;


            document.getElementById(
                "orbValue"
            ).textContent =
                value.replace("%", "");


            document.getElementById(
                "brightnessModeTitle"
            ).textContent =
                name;


            showToast(
                "Brightness Mode",
                `${name} mode selected.`
            );

        }
    );

});


/* =====================================================
   TOAST
===================================================== */

const toast =
    document.getElementById(
        "toast"
    );

const toastTitle =
    document.getElementById(
        "toastTitle"
    );

const toastMessage =
    document.getElementById(
        "toastMessage"
    );


let toastTimer;


function showToast(
    title,
    message
) {

    toastTitle.textContent =
        title;

    toastMessage.textContent =
        message;


    toast.classList.add(
        "show"
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            2800
        );

}


/* =====================================================
   SMALL INTERACTION:
   SUMMARY CARD HOVER
===================================================== */

document
    .querySelectorAll(".summary-card")
    .forEach(card => {

        card.addEventListener(
            "mouseenter",
            () => {

                card.style.transform =
                    "translateY(-5px)";

            }
        );


        card.addEventListener(
            "mouseleave",
            () => {

                card.style.transform =
                    "translateY(0)";

            }
        );

    });


/* =====================================================
   KEYBOARD NAVIGATION
===================================================== */

document.addEventListener(
    "keydown",
    event => {

        if (event.key === "Escape") {

            sidebar.classList.remove(
                "open"
            );

        }

    }
);


/* =====================================================
   INITIAL STATE
===================================================== */

showPage("dashboard");