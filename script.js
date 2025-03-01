// Define Hungarian month names (0-indexed)
const hungarianMonths = [
    "január", "február", "március", "április", "május", "június",
    "július", "augusztus", "szeptember", "október", "november", "december"
];

// Define a custom formatter that outputs "YYYY. <Hungarian month name> dd."
const dateFormatter = date => {
    const year = d3.timeFormat("%Y")(date);
    const day = d3.timeFormat("%d")(date);
    const monthName = hungarianMonths[date.getMonth()];
    return `${year}. ${monthName} ${day}.`;
};

// Non-scaling settings
let upperThreshold = 5;
let zoomInit = false;

const tickBaseWidth = 3; // in pixels
function getTickWidth(k) {
    if (k < upperThreshold) {
        return tickBaseWidth / k;
    }
    else {
        return tickBaseWidth / upperThreshold;
    }
}

const tickBaseLength = 30;
function getTickLength(k) {
    if (k < upperThreshold) {
        return tickBaseLength / k;
    }
    else {
        return tickBaseLength / upperThreshold;
    }
}

const eventLabelBaseOffset = 25;
function getEventLabelOffset(k) {
    if (k < upperThreshold) {
        return eventLabelBaseOffset / k;
    }
    else {
        return eventLabelBaseOffset / upperThreshold;
    }
}

const timelineBaseWidth = 5; // in pixels
function getTimelineWidth(k) {
    if (k < upperThreshold) {
        return timelineBaseWidth / k;
    }
    else {
        return timelineBaseWidth / upperThreshold;
    }
}

upperThreshold = 6;

const eventLabelBaseFontSize = 18;
function getEventLabelFontSize(k) {
    if (k < upperThreshold) {
        return eventLabelBaseFontSize / k;
    }
    else {
        return eventLabelBaseFontSize / upperThreshold;
    }
}


// Main drawer

(async function () {
    // 1) Load settings
    const settings = await d3.json(`timelines/settings.json`);
    const ids = Object.keys(settings);
    const view = await d3.json("view.json");

    // 2) Load each timeline JSON
    const timelineDataArray = await Promise.all(
        ids.map(async (id) => {
            const data = await d3.json(`timelines/${id}.json`);
            return { id, data };
        })
    );

    // ---- LOCALSTORAGE PINNED LABELS MAP ----
    const localStorageKey = "pinnedLabels";
    let pinnedLabelsMap = {};

    const stored = localStorage.getItem(localStorageKey);
    if (stored) {
        try {
            pinnedLabelsMap = JSON.parse(stored);
        } catch (err) {
            console.warn("Could not parse pinnedLabels from localStorage:", err);
            pinnedLabelsMap = {};
        }
    }

    // 3) Parse dates & find global min/max
    const parseDate = d3.timeParse("%Y.%m.%d.");
    let globalDates = [];
    let focusDates = [];

    timelineDataArray.forEach((t) => {
        t.data.forEach((item) => {
            if (item.type === "event") {
                item.parsedDate = parseDate(item.date);
                globalDates.push(item.parsedDate);
                if (item.focus) {
                    focusDates.push(item.parsedDate);
                }
            } else if (item.type === "period") {
                item.parsedDateStart = parseDate(item.dateStart);
                item.parsedDateEnd = parseDate(item.dateEnd);
                globalDates.push(item.parsedDateStart, item.parsedDateEnd);
                if (item.focus) {
                    focusDates.push(item.parsedDateStart, item.parsedDateEnd);
                }
                const uniqueKey = t.id + "::" + item.label;
                const isPinned = !!pinnedLabelsMap[uniqueKey];
                item.showLabel = isPinned;
            }
        });
    });

    const [globalMin, globalMax] = d3.extent(focusDates);

    // 4) Setup the single SVG
    const container = d3.select("#timeline-container");
    const width = container.node().clientWidth;
    const height = container.node().clientHeight;

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("id", "main-svg");

    const gMain = svg.append("g");

    // 5) Zoom/pan (single zoom behavior)
    const zoomBehavior = d3.zoom()
        .scaleExtent([1, 10])
        .on("zoom", (event) => {
            gMain.attr("transform", event.transform);
            // Compute new stroke width based on current zoom scale:
            //console.log(event.transform.k)

            // Update scaling
            gMain.selectAll(".period-bar.scaling")
                .each(function () {
                    const label = d3.select(this);
                    label.attr("stroke-width", getTickLength(event.transform.k) * 0.5)
                });
            gMain.selectAll(".period-label.scaling")
                .each(function () {
                    const label = d3.select(this);
                    const my = +label.attr("my");
                    label.attr("font-size", getEventLabelFontSize(event.transform.k) + "px")
                        .attr("y", my + getTickLength(event.transform.k) * 1.125);
                });

            gMain.selectAll(".event-tick.scaling")
                .each(function () {
                    const tick = d3.select(this);
                    const cy = +tick.attr("cy");  // center of the tick
                    console.log(cy - getTickLength(event.transform.k) / 2)
                    tick.attr("y1", cy - getTickLength(event.transform.k) / 2)
                        .attr("y2", cy + getTickLength(event.transform.k) / 2)
                        .style("stroke-width", getTickWidth(event.transform.k) + "px");
                });


            gMain.selectAll(".event-label.scaling")
                .each(function () {
                    const label = d3.select(this);
                    // Retrieve current y1 and y2 (as numbers)
                    const cx = +label.attr("cx");
                    const cy = +label.attr("cy");
                    label.attr("y", cy - getEventLabelOffset(event.transform.k))
                        .attr("transform", `rotate(-45, ${cx}, ${cy - getEventLabelOffset(event.transform.k)})`)
                        .attr("font-size", getEventLabelFontSize(event.transform.k) + "px");
                });


            gMain.selectAll(".event-date.scaling")
                .each(function () {
                    const date = d3.select(this);
                    // Retrieve current y1 and y2 (as numbers)
                    const cx = +date.attr("cx");
                    const cy = +date.attr("cy");
                    date.attr("y", cy + getEventLabelOffset(event.transform.k) * 15 / 25)
                        .attr("transform", `rotate(-90, ${cx}, ${cy + getEventLabelOffset(event.transform.k) * 15 / 25})`)
                        .attr("font-size", getEventLabelFontSize(event.transform.k) + "px");

                });

            gMain.selectAll(".timeline-path")
                .style("stroke-width", getTimelineWidth(event.transform.k) + "px");

            if (updateGrid) {
                updateGrid(event.transform.k);
            }
        });

    svg.call(zoomBehavior);

    // 6) Global X scale
    const margin = 50;
    const leftMargin = margin * 2;
    const rightMargin = margin;
    const xScaleGlobal = d3.scaleTime()
        .domain([globalMin, globalMax])
        .range([leftMargin, width - rightMargin]);

    // Parallel lines config
    const slopeConstant = 0;  // zero slope for horizontal timeline

    // 7) Date grid
    function drawVerticalDateLines() {
        const gGrid = gMain.append("g").attr("class", "date-grid");

        function updateGrid(k) {
            gGrid.selectAll("*").remove(); // Clear old grid

            const transform = d3.zoomTransform(svg.node()); // Get current zoom state
            console.log(transform)

            // Compute visible time range based on zoom/pan transformation
            const visibleMin = xScaleGlobal.invert(transform.invertX(0));
            const visibleMax = xScaleGlobal.invert(transform.invertX(width));

            const startYear = Math.floor(visibleMin.getFullYear() / 10) * 10; // Round down to nearest 10
            const endYear = Math.ceil(visibleMax.getFullYear() / 10) * 10; // Round up to nearest 10

            for (let year = startYear - 100; year <= endYear + 100; year++) { // Extend beyond visible range
                const x = xScaleGlobal(new Date(year, 0, 1));

                if (year % 10 === 0) {
                    gGrid.append("line")
                        .attr("class", "grid-line-primary")
                        .attr("x1", x)
                        .attr("y1", -height * 5) // Extend far beyond view
                        .attr("x2", x)
                        .attr("y2", height * 5);
                    gGrid.append("text")
                        .attr("class", "grid-label-primary")
                        .attr("x", x + 14)
                        .attr("y", 20 - transform.y / transform.k)
                        .attr("text-anchor", "middle")
                        .attr("transform", `rotate(-90, ${x + 14}, ${20 - transform.y / transform.k})`)
                        .text(year);

                }
                else if (year % 5 === 0) {
                    gGrid.append("line")
                        .attr("class", "grid-line-secondary")
                        .attr("x1", x)
                        .attr("y1", -height * 5)
                        .attr("x2", x)
                        .attr("y2", height * 5);

                    gGrid.append("text")
                        .attr("class", "grid-label-primary")
                        .attr("x", x + 14)
                        .attr("y", 20 - transform.y / transform.k)
                        .attr("text-anchor", "middle")
                        .attr("transform", `rotate(-90, ${x + 14}, ${20 - transform.y / transform.k})`)
                        .text(year);
                }
                else {
                    gGrid.append("line")
                        .attr("class", "grid-line-ternary")
                        .attr("x1", x)
                        .attr("y1", -height * 5)
                        .attr("x2", x)
                        .attr("y2", height * 5);
                }
            }
        }

        updateGrid(1); // Initial draw

        return updateGrid;
    }

    const updateGrid = drawVerticalDateLines();

    // 8) Draw each timeline
    timelineDataArray.forEach((timelineObj, i) => {
        const { id, data } = timelineObj;

        // Compute local min/max for both period and event entries.
        const localMin = d3.min(data, d => d.type === "period" ? d.parsedDateStart : d.parsedDate);
        let localMax = d3.max(data, d => d.type === "period" ? d.parsedDateEnd : d.parsedDate);

        // If only one event exists (or all entries have the same date), add one day.
        if (localMin.getTime() === localMax.getTime()) {
            localMax = new Date(localMin.getTime() + 86400000);
        }

        const xStart = xScaleGlobal(localMin);
        const xEnd = xScaleGlobal(localMax);

        // Calculate horizontal offset from globalMin.
        const ox = xStart - xScaleGlobal(globalMin);

        const dx = xEnd - xStart;

        // Even if there are only events, draw a baseline spanning the full local range.
        //const yStart = topMargin + i * rowSpacing + slopeConstant * ox;
        //const yEnd = yStart + slopeConstant * dx;

        // Instead of using rowSpacing and topMargin, compute yStart from settings[id].vPos:
        const vPos = settings[id].vPos;  // should be a number between 0 and 1
        const yStart = vPos * height + slopeConstant * ox;    // vertical position in the viewport
        // Optionally, keep a slope for the timeline’s end position (or set slopeConstant to 0 for horizontal)
        // Here, we add a small offset based on dx if desired:
        const yEnd = yStart + slopeConstant * dx;


        // Draw the baseline if enabled in settings.
        if (settings[id].line) {
            const timelinePath = gMain.append("line")
                .attr("class", "timeline-path")
                .attr("x1", xStart)
                .attr("y1", yStart)
                .attr("x2", xEnd)
                .attr("y2", yEnd)
                .attr("stroke-width", getTimelineWidth(1) + "px");
        }

        // Helper: position on the line for a given date.
        function positionOnLine(date) {
            const fraction = (date - localMin) / (localMax - localMin);
            const x = xStart + fraction * dx;
            const y = yStart + fraction * slopeConstant * dx;
            return [x, y];
        }

        // Draw the timeline id label at the beginning of the timeline
        if (settings[id].label) {
            gMain.append("text")
                .attr("class", "timeline-label")
                .attr("x", xStart - 40)       // position left of the timeline start
                .attr("y", yStart - 0)        // vertically aligned with the baseline
                .attr("transform", `rotate(-90, ${xStart - 40}, ${yStart - 0})`)
                .text(settings[id].label);
        }

        // Separate period and event entries.
        const periods = data.filter(d => d.type === "period");
        const events = data.filter(d => d.type === "event");

        // ---- PERIODS ----
        periods.forEach(period => {
            const [x1, y1] = positionOnLine(period.parsedDateStart);
            const [x2, y2] = positionOnLine(period.parsedDateEnd);

            const periodBar = gMain.append("line")
                .attr("class", "period-bar" + (!settings[id].scaleLabels ? " scaling" : ""))
                .attr("x1", x1)
                .attr("y1", y1)
                .attr("x2", x2)
                .attr("y2", y2)
                .attr("stroke-width", getTickLength(1) * 0.5)
                .attr("stroke", period.color ? period.color : "gray")
                .style("pointer-events", "stroke");


            const midTime = new Date((period.parsedDateStart.getTime() + period.parsedDateEnd.getTime()) / 2);
            const [mx, my] = positionOnLine(midTime);
            const periodLabel = gMain.append("text")
                .style("pointer-events", "none")
                .attr("font-size", getEventLabelFontSize(1) + "px")
                .attr("class", "period-label" + (!settings[id].scaleLabels ? " scaling" : ""))
                .attr("mx", mx)
                .attr("my", my)
                .attr("x", mx)
                .attr("y", my + getTickLength(1) * 1.125)
                .text(period.label)
                .style("visibility", "hidden");

            const uniqueKey = id + "::" + period.label;

            function redrawLabel(visible) {
                periodLabel.style("visibility", visible ? "visible" : "hidden");
            }

            // Set initial state based on whether it's already in view.pinnedLabels
            let isPinned = view.pinnedLabels.includes(uniqueKey);
            redrawLabel(isPinned);

            periodBar
                .on("mouseover", function () {
                    if (!isPinned) redrawLabel(true);
                })
                .on("mouseout", function () {
                    if (!isPinned) redrawLabel(false);
                })
                .on("click", function () {
                    // Toggle pinned state
                    isPinned = !isPinned;
                    if (isPinned) {
                        view.pinnedLabels.push(uniqueKey);
                    } else {
                        view.pinnedLabels = view.pinnedLabels.filter(key => key !== uniqueKey);
                    }
                    redrawLabel(isPinned);
                    console.log(view)
                });

        });

        // ---- EVENTS ----
        events.forEach((ev) => {
            const [cx, cy] = positionOnLine(ev.parsedDate);

            // Draw event tick (vertical line) instead of a circle.
            const eventMarker = gMain.append("line")
                .attr("class", "event-tick" + (!settings[id].scaleLabels ? " scaling" : ""))
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("x1", cx)
                .attr("x2", cx)
                .attr("y1", cy - getTickLength(1) / 2)
                .attr("y2", cy + getTickLength(1) / 2)
                .style("cursor", "pointer")
                .attr("stroke-width", getTickWidth(1) + "px");

            // Function to create the event info group (label and date)
            function createEventInfo() {
                const group = gMain.append("g")
                    .attr("class", "event-info");
                group.append("text")
                    .attr("class", "event-label" + (!settings[id].scaleLabels ? " scaling" : ""))
                    .attr("font-size", getEventLabelFontSize(1) + "px")
                    .attr("cx", cx)
                    .attr("cy", cy)
                    .attr("x", cx)
                    .attr("y", cy - getEventLabelOffset(1))
                    .attr("transform", `rotate(-45, ${cx}, ${cy - getEventLabelOffset(1)})`)
                    .text(ev.label);
                if (settings[id].showDates) {
                    group.append("text")
                        .attr("class", "event-date" + (!settings[id].scaleLabels ? " scaling" : ""))
                        .attr("font-size", getEventLabelFontSize(1) + "px")
                        .attr("cx", cx)
                        .attr("cy", cy)
                        .attr("x", cx)
                        .attr("y", cy + getEventLabelOffset(1) * 15 / 25)
                        .attr("transform", `rotate(-90, ${cx}, ${cy + getEventLabelOffset(1) * 15 / 25})`)
                        .text(dateFormatter(parseDate(ev.date)));
                }
                group.style("visibility", "hidden")
                return group.node();
            }

            const eventLabels = createEventInfo();
            const uniqueKey = id + "::" + ev.label;

            function redrawLabel(visible) {
                d3.select(eventLabels).style("visibility", visible ? "visible" : "hidden");
            }

            // Set initial state based on whether it's already in view.pinnedLabels
            let isPinned = view.pinnedLabels.includes(uniqueKey);
            redrawLabel(isPinned);

            eventMarker
                .on("mouseover", function () {
                    if (!isPinned) redrawLabel(true);
                })
                .on("mouseout", function () {
                    if (!isPinned) redrawLabel(false);
                })
                .on("click", function () {
                    // Toggle pinned state
                    isPinned = !isPinned;
                    if (isPinned) {
                        view.pinnedLabels.push(uniqueKey);
                    } else {
                        view.pinnedLabels = view.pinnedLabels.filter(key => key !== uniqueKey);
                    }
                    redrawLabel(isPinned);
                    console.log(view)
                });
        });

    });
})();
