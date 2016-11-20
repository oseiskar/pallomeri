
function redGreenGradient(v) {
    return {
        r: 1.0 - Math.max(v - 0.5, 0) * 2,
        g: Math.min(v * 2.0, 1),
        b: 0.0
    };
}

function floatRgbToColorString(col) {
    f = c => (100*Math.max(Math.min(c, 1.0), 0.0)) + '%';
    return "rgb("+f(col.r)+","+f(col.g)+","+f(col.b)+")";
}

function Pallomeri(svgElement) {

    this.canvas = {
        width: 600,
        height: 400
    };

    this.paddingPercent = 0.1;

    this.colorFunc = redGreenGradient;

    this.nBins = 5;
    this.nColorBins = null;
    this.xLim = [0, 1];

    this.d3root = d3.select(svgElement)
        .attr('viewBox', '0 0 '+this.canvas.width+' '+this.canvas.height)
        .append('g');
}

Pallomeri.prototype.getBins = () => {
    const x0 = this.xLim[0];
    const x1 = this.xLim[1];

    if (nBins === 0) return [0];
    return _.range(0, nBins).map(i => x0 + (x1-x0)/(nBins-1) * i);
};

Pallomeri.prototype.partition = function(data, valueFunc) {
    const x0 = this.xLim[0];
    const x1 = this.xLim[1];
    const nBins = this.nBins;
    const fullWidth = this.canvas.width;

    const binSize = (x1-x0)/nBins;
    const scale = fullWidth / (x1-x0);

    var bins = _.range(0, nBins).map(function(i) {
        return {
            x0: (x0 + binSize * i) * scale,
            width: scale * binSize,
            contents: []
        };
    });

    _.forEach(data, function(d) {
        let b = Math.floor((valueFunc(d) - x0) / binSize);
        b = Math.max(Math.min(b, nBins-1), 0);

        bins[b].contents.push(d);
    });

    _.forEach(bins, bin => {
        bin.contents = _.sortBy(bin.contents, valueFunc);
    });

    return bins;
};

Pallomeri.prototype.arrangeBin = function(bin, nSlots) {

    const slotSize = bin.width / nSlots;
    const ballSize = slotSize * (1.0 - this.paddingPercent) * 0.5;
    const bottomY = this.canvas.height;

    const nRows = Math.ceil(bin.contents.length / nSlots);

    var rowIdx = 0;
    var slotIdx = 0;

    return _.map(bin.contents, function(d, i) {

        const item = {
            item: d,
            ball: {
                cx: (slotIdx + 0.5) * slotSize,
                cy: bottomY- (rowIdx + 0.5) * slotSize,
                r: ballSize
            }
        };

        rowIdx += 1;
        if (rowIdx >= nRows) {
            slotIdx += 1;
            rowIdx = 0;
        }

        return item;
    });
};

function solveMinNSlots(binWidth, canvasHeight, nItems) {
    const w = binWidth, h = canvasHeight, n = nItems;
    // solve quadratic equation
    return Math.ceil(0.5*(w + Math.sqrt(w*w + 4*h*w*n))/h);
}

Pallomeri.prototype.render = function(data, valueFunc) {

    const bins = this.partition(data, valueFunc);
    if (bins.length === 0) return;

    const that = this;
    const maxItems = _.max(bins.map(b => b.contents.length));

    const nSlots = solveMinNSlots(bins[0].width, this.canvas.height, maxItems);

    let colStepFunc = x => x;
    if (this.nColorBins) {
        let cBins = this.nColorBins;
        colStepFunc = x => Math.floor(x * cBins)*1.0 / (cBins-1);
    }

    this.balls = this.d3root
        .selectAll('g')
        .data(bins)
        .enter()
        .append('g')
        .attr('transform', bin => 'translate(' + bin.x0 + ',0)')
        .selectAll('circle')
        .data(bin => that.arrangeBin(bin, nSlots))
        .enter()
        .append('circle')
        .attr('class', 'ball')
        .attr('stroke', 'black')
        .attr('stroke-width', 0)
        .attr('cx', d => d.ball.cx)
        .attr('cy', d => d.ball.cy)
        .attr('r', d => d.ball.r)
        .attr('fill', d =>
            floatRgbToColorString(
                that.colorFunc(
                    colStepFunc(
                        valueFunc(d.item)))));
};

Pallomeri.prototype.setTextTooltip = function(titleFunc) {
    this.balls.append('title')
        .text(d => titleFunc(d.item));
};



Pallomeri.prototype.setD3ClickDialog = function(func, style) {

    style = _.defaults(style, {
        "opacity": 1.0,
        "background": 'white',
        "padding": '5px',
        "border": '1px solid black'
    });

    var tooltipDiv = d3.select("body").append("div");

    _.forEach(style, function(val, key) {
        tooltipDiv = tooltipDiv.style(key, val);
    });


    tooltipDiv = tooltipDiv
        .style("position", "absolute")
        .style("opacity", 0);

    var last = null;
    var lastDatum = null;

    const xOffset = 3;
    const yOffset = 3;

    this.balls.on("click", function(d){
        if (last) {
            last.attr('stroke-width', 0);
        }

        const cur = d3.select(this);
        if (lastDatum === cur.datum()) {
            lastDatum = null;
            return tooltipDiv.style("opacity", 0);
        }

        lastDatum = cur.datum();
        last = cur;

        cur.attr('stroke-width', 1);

        func(tooltipDiv
            .style("opacity", style.opacity)
            .style("left", (d3.event.pageX + xOffset) + "px")
            .style("top", (d3.event.pageY + yOffset) + "px"), d.item);
    });
};


Pallomeri.prototype.setHtmlClickDialog = function(htmlFunc, style) {
    this.setD3ClickDialog((el, d) => el.html(htmlFunc(d)), style);
};

Pallomeri.prototype.setDefaultClickDialog = function(style) {
    this.setD3ClickDialog(function(el, item) {

        // clear existing data... a bit non-d3-ish
        el.selectAll('*').remove();

        let p = el.selectAll('div').data(_.keys(item));
        let divs = p.enter().append('div');

        divs.append('b').text(d => d + ": ");
        divs.append('span').text(d => item[d]);

        p.exit().remove();

    }, style);
};
