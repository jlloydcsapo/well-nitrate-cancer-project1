var cancerTracts
var wellPoints
var IDWSurface
var aggregateSurface

var baseLayers = {};
var layers = {};

var tracts = L.layerGroup();
var wells = L.layerGroup();
var interpolatedLayer = L.layerGroup();
var aggregateLayer = L.layerGroup();

//add OSM base tilelayer
var OSMLayer = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
});

baseLayers.OpenStreetMap = OSMLayer;

//initial map options
var mapOptions = {
    center: [44.669778, -89.311975],
    zoom: 7,
    minZoom: 6,
    maxZoom: 17,
    maxBounds: L.latLngBounds([40.822448, -80.120168], [48.628936, -100.325876]), // panning bounds so the user doesn't pan too far away from Wisconsin       
    layers: [OSMLayer]
};

//create map
var map = L.map('map', mapOptions);

map.createPane('tracts');
map.getPane('tracts').style.zIndex = 250;

// cycle through geojson to get an array for census tracts
$.getJSON( "data/cancer_tracts.json", function(data){
    cancerTracts = L.geoJson(data, {
        pane: 'tracts'
    }).addTo(tracts);

    tracts.addTo(map);
    visualizeTracts();
});

layers.Tracts = tracts;

map.createPane('wells').style.zIndex = 620;

$.getJSON( "data/well_nitrate.json", function(data){
    wellPoints = L.geoJson(data, {
        pointToLayer: createPointLayer,
        pane: 'wells'
    }).addTo(wells);

    wells.addTo(map);
    visualizeWells();
});

$( "#interpolateBtn").click(function(){
    var k = Number($("#decayCoeff").val());
    var aggArea = $("#AggArea").val();
    console.log("K = " + k + ", AggArea = " + aggArea);
    interpolateWells(k, aggArea);
});

$( "#regressionBtn").click(function(){
    var k = Number($("#decayCoeff").val());
    var aggArea = $("#AggArea").val();
    console.log("Performing regression...")
    regression();
});

$( "#resetBtn").click(function(){
    console.log("Resetting layers");

    if(map.hasLayer(IDWSurface)) {
        interpolatedLayer.remove(IDWSurface);
        layerControl.removeLayer(interpolatedLayer);
        var IDWLegend = document.getElementById("IDW-legend");
        
        if (IDWLegend != null) {
            IDWLegend.remove();
        }; 
    };

    if(map.hasLayer(aggregateSurface)) {
        aggregateLayer.remove(aggregateSurface);
        layerControl.removeLayer(aggregateLayer);
    };
    
    var decay = document.getElementById("decayCoeff");
    decay.value = decay.defaultValue;

    var decay = document.getElementById("AggArea");
    decay.value = decay.defaultValue;

    Plotly.deleteTraces("regression-chart", [0,1]);
    document.getElementById("regression-text").innerHTML = "";
});

$( "#downloadBtn").click(function(){
    if(map.hasLayer(IDWSurface)) {
        console.log("Downloading interpolated layer...");
        var downloadFile = IDWSurface.toGeoJSON();
        console.log(downloadFile);
        var path = 'text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(downloadFile))   
        document.getElementById('downloadBtn').setAttribute('href', 'data:' + path);
        document.getElementById('downloadBtn').setAttribute('download','IDWSurface.geoJson'
        );
    } else {
        alert('Nothing to download!')
    }
});
    
layers.Wells = wells;

var layerControl = L.control.layers(baseLayers, layers).addTo(map);

function createPointLayer (feature, latlng) {
var pointLayerStyle = {
    radius: 3,
    weight: 0.25, // set stroke weight
    fillOpacity: 1, // override the default fill opacity
    opacity: 1 // border opacity
    }

// var popupContent = "<b>Nitrate Concentration: </b>" + feature.properties.nitr_ran.toFixed(2) + " ppm"; 
var layer = L.circleMarker(latlng, pointLayerStyle);
// layer.bindPopup(popupContent);
return layer
};

function visualizeWells(){
    console.log("Visualizing wells...");

    // Get the class breaks based on the ckmeans method
	var breaks = getNitrateBreaks(wellPoints);
    
	wellPoints.eachLayer(function (layer) {
		// Set its color based on the nitrate concentration
        layer.setStyle({
            color: nitrateColorBreaks(layer.feature.properties.nitr_ran, breaks),
            weight: 2
        });
		// Build the popup for the well point
        var popup = "<b>Nitrate Concentration: </b>" + layer.feature.properties.nitr_ran.toFixed(2) + " ppm";

        // Bind the popup to the well point
        layer.bindPopup(popup);
	});

    createNitrateLegend(breaks);
};

function visualizeTracts(){
    console.log("Visualizing tracts...");

    // Get the class breaks based on the ckmeans method
	var breaks = getCancerBreaks(cancerTracts);
    
	cancerTracts.eachLayer(function (layer) {
		// Set its color based on the nitrate concentration
        layer.setStyle({
            color: cancerColorBreaks(layer.feature.properties.canrate, breaks),
            weight: 2,
            fillOpacity: 0.5, // override the default fill opacity
            opacity: 1
        });
		// Build the popup for the well point
        var popup = "<b>Cancer Rate: </b>" + layer.feature.properties.canrate.toFixed(2);

        // Bind the popup to the well point
        layer.bindPopup(popup);
	});

    createTractLegend(breaks);
};

function getNitrateBreaks(featureData) {
    console.log("Getting classification breaks (Nitrate)...");

    var values = [];

    featureData.eachLayer(function(layer){
        values.push(layer.feature.properties.nitr_ran);
    });

    var clusters = ss.ckmeans(values, 5);

    var breaks = clusters.map(function (cluster) {
        return [cluster[0], cluster.pop()];
    });

    console.log(breaks);
    return breaks;
};

function getCancerBreaks(featureData) {
    console.log("Getting classification breaks (Cancer)...");

    var values = [];

    featureData.eachLayer(function(layer){
        values.push(layer.feature.properties.canrate);
    });

    var clusters = ss.ckmeans(values, 5);

    var breaks = clusters.map(function (cluster) {
        return [cluster[0], cluster.pop()];
    });

    console.log(breaks);
    return breaks;
};

function nitrateColorBreaks(value, breaks){
    
    // If the data value <= the upper value of the first cluster
    if (value <= breaks[0][1]) {
        return '#69b34c';

        // If the data value <= the upper value of the second cluster    
    } else if (value <= breaks[1][1]) {
        return '#acb334';

        // If the data value <= the upper value of the third cluster   
    } else if (value <= breaks[2][1]) {
        return '#fab733';

        // If the data value <= the upper value of the fourth cluster   
    } else if (value <= breaks[3][1]) {
        return '#ff8e15';

        // If the data value <= the upper value of the fifth cluster  
    } else if (value <= breaks[4][1]) {
        return '#ff0d0d';

    }
};

function cancerColorBreaks(value, breaks){
    
    // If the data value <= the upper value of the first cluster
    if (value <= breaks[0][1]) {
        return '#f7f7f7';

        // If the data value <= the upper value of the second cluster    
    } else if (value <= breaks[1][1]) {
        return '#cccccc';

        // If the data value <= the upper value of the third cluster   
    } else if (value <= breaks[2][1]) {
        return '#969696';

        // If the data value <= the upper value of the fourth cluster   
    } else if (value <= breaks[3][1]) {
        return '#636363';

        // If the data value <= the upper value of the fifth cluster  
    } else if (value <= breaks[4][1]) {
        return '#252525';

    }
};

function createIDWLegend(breaks){
	var legendControl = L.control({
		position: 'bottomright'
    });

    // When the legend is added to the map
    legendControl.onAdd = function () {

        // Create a new HTML <div> element and give it a class name of "legend"
        var div = L.DomUtil.create('div', 'IDWlegend');
        div.setAttribute('id','IDW-legend');
        // First append an <h3> heading tag to the div holding the current attribute
        div.innerHTML = "<h6><b>Nitrate Concentration (interpoloated)</b></h6>";

        // For each of our breaks
        for (var i = 0; i < breaks.length; i++) {
            
            // Determine the color associated with each break value, including the lower range value
            var color = nitrateColorBreaks(breaks[i][0], breaks);
            console.log(color);

            // Concatenate a <span> tag styled with the color and the range values of that class and include a label with the low and high ends of that class range
            div.innerHTML +=
                '<span style="background:' + color + '"></span> ' + 
                '<label><b>' + parseFloat(breaks[i][0]).toFixed(2).toLocaleString() + ' &mdash; ' +
                parseFloat(breaks[i][1]).toFixed(2).toLocaleString() + ' ppm' + '</b></label>'

        }

        // Return the populated legend div to be added to the map   
        return div;

    }; // end onAdd method

    // Add the legend to the map
    legendControl.addTo(map);
};

function createNitrateLegend(breaks){
	var legendControl = L.control({
		position: 'bottomright'
    });

    // When the legend is added to the map
    legendControl.onAdd = function () {

        // Create a new HTML <div> element and give it a class name of "legend"
        var div = L.DomUtil.create('div', 'legend');
        div.setAttribute('id','nitrate-legend');
        // First append an <h3> heading tag to the div holding the current attribute
        div.innerHTML = "<h5><b>Nitrate Concentration (parts per million)</b></h5>";

        // For each of our breaks
        for (var i = 0; i < breaks.length; i++) {
            
            // Determine the color associated with each break value, including the lower range value
            var color = nitrateColorBreaks(breaks[i][0], breaks);
            console.log(color);

            // Concatenate a <span> tag styled with the color and the range values of that class and include a label with the low and high ends of that class range
            div.innerHTML +=
                '<span style="background:' + color + '"></span> ' + 
                '<label><b>' + parseFloat(breaks[i][0]).toFixed(2).toLocaleString() + ' &mdash; ' +
                parseFloat(breaks[i][1]).toFixed(2).toLocaleString() + ' ppm' + '</b></label>'

        }

        // Return the populated legend div to be added to the map   
        return div;

    }; // end onAdd method

    // Add the legend to the map
    legendControl.addTo(map);
};

function createTractLegend(breaks){
	var legendControl = L.control({
		position: 'bottomleft'
    });

    // When the legend is added to the map
    legendControl.onAdd = function () {

        // Create a new HTML <div> element and give it a class name of "legend"
        var div = L.DomUtil.create('div', 'legend');
        // First append an <h3> heading tag to the div holding the current attribute
        div.innerHTML = "<h5><b>Cancer Rate by County</b></h5>";

        // For each of our breaks
        for (var i = 0; i < breaks.length; i++) {
            
            // Determine the color associated with each break value, including the lower range value
            var color = cancerColorBreaks(breaks[i][0], breaks);
            console.log(color);

            // Concatenate a <span> tag styled with the color and the range values of that class and include a label with the low and high ends of that class range
            div.innerHTML +=
                '<span style="background:' + color + '"></span> ' + 
                '<label><b>' + parseFloat(breaks[i][0]).toFixed(2).toLocaleString() + ' &mdash; ' +
                parseFloat(breaks[i][1]).toFixed(2).toLocaleString() + '</b></label>'

        }

        // Return the populated legend div to be added to the map   
        return div;

    }; // end onAdd method

    // Add the legend to the map
    legendControl.addTo(map);
};

function interpolateWells(k, hexArea){   

    var options = {
        gridType: 'triangle', // use hexbins as the grid type
        property: 'nitr_ran', // interpolate values from the nitrate concentrations
        units: 'miles', // hexbin size units
        weight: k // distance decay coefficient, q
    };

    var wellPointArray= [];

    wellPoints.eachLayer(function(layer) {
            var properties = layer.feature.properties;
            var coord = layer.feature.geometry.coordinates;

            var wellTurfPoint = turf.point(coord, properties);
            wellPointArray.push(wellTurfPoint);
    });

    var turfPointCollection = turf.featureCollection(wellPointArray);

    var interpolatedSurface = turf.interpolate(turfPointCollection, hexArea, options);
    
    console.log(interpolatedSurface);

    IDWSurface = L.geoJson(interpolatedSurface, {
        // Create a style for the census tracts
        style: function (feature) {
            return {
                fillOpacity: 0.5, // override the default fill opacity
                opacity: 1 // border opacity
            };
        }
    }).addTo(interpolatedLayer);

    var breaks = getNitrateBreaks(IDWSurface);

    IDWSurface.eachLayer(function (layer) {
		// Set its color based on the nitrate concentration
        layer.setStyle({
            color: nitrateColorBreaks(layer.feature.properties.nitr_ran, breaks),
            weight: 2
        });
		// Build the popup for the well point
        var popup = "<b>Nitrate Concentration: </b>" + layer.feature.properties.nitr_ran.toFixed(2) + " ppm";

        // Bind the popup to the well point
        layer.bindPopup(popup);
	});
    
    createIDWLegend(breaks);

    interpolatedLayer.addTo(map);

    // layers.Interpolation = interpolatedLayer; 
    layerControl.addOverlay(interpolatedLayer, "Interpolation");
};

function regression(){
    console.log("aggregrating well data to tracts...");

    var wellPointArray= [];
    wellPoints.eachLayer(function(layer) {
            var properties = layer.feature.properties;
            var coord = layer.feature.geometry.coordinates;

            var wellTurfPoint = turf.point(coord, properties);
            wellPointArray.push(wellTurfPoint);
    });

    var turfPointCollection = turf.featureCollection(wellPointArray);

    var cancerPolyArray= [];

    cancerTracts.eachLayer(function(layer) {
            var properties = layer.feature.properties;
            var coord = layer.feature.geometry.coordinates;

            var cancerPoly = turf.polygon(coord, properties);
            cancerPolyArray.push(cancerPoly);
    });

    var turfPolyCollection = turf.featureCollection(cancerPolyArray);
    
    var aggregatedLayer = turf.collect(turfPolyCollection, turfPointCollection, 'nitr_ran', 'nitr_vals');
    
    //add aggregated layer 
    aggregateSurface = L.geoJson(aggregatedLayer, {
    }).addTo(aggregateLayer);


    var breaks = getCancerBreaks(cancerTracts);

    aggregateSurface.eachLayer(function (layer) {
		// Set its color based on the nitrate concentration
        layer.setStyle({
            color: cancerColorBreaks(layer.feature.properties.canrate, breaks),
            weight: 2,
            fillOpacity: 0.5, // override the default fill opacity
            opacity: 1
        });

        var nitr_array = layer.feature.properties.nitr_vals;

        var mean_nitr;

        if (nitr_array.length == 0){
            mean_nitr = 0;
        } else {
            mean_nitr = ss.mean(nitr_array);
        }
        
        layer.feature.properties.mean_nitr = mean_nitr;

		// Build the popup for the well point
        var popup = "<b>Cancer Rate: </b>" + layer.feature.properties.canrate.toFixed(2);
        popup += "<br/><b>Mean Nitrate PPM: </b>" + layer.feature.properties.mean_nitr.toFixed(2);
        // Bind the popup to the well point
        layer.bindPopup(popup);
	});

    var nitrArray = [];
    var canArray = [];
    nitrCancPairs = [];

    aggregateSurface.eachLayer(function(layer) {
        var nitr = layer.feature.properties.mean_nitr;
        var can_rate = layer.feature.properties.canrate;

        var nitrCanRate = [nitr, can_rate];
        nitrCancPairs.push(nitrCanRate);

        nitrArray.push(nitr);
        canArray.push(can_rate);
    });

    console.log(nitrCancPairs);
    var regressionLine = ss.linearRegression(nitrCancPairs);
    
    console.log("slope = " + regressionLine.m);
    console.log("y-intercept = " + regressionLine.b);
    
    aggregateLayer.addTo(map);

    // layers.Interpolation = interpolatedLayer; 
    layerControl.addOverlay(aggregateLayer, "Aggregate");

    const ctx = document.getElementById('regression-chart');
      
      var trace2 = {
        x: nitrArray,
        y: canArray,
        mode: 'markers',
        type: 'scatter',
        name: 'Nitrate vs Cancer Levels'
      };

      var trace1 = {
        x:[-1,15],
        y:[lineEq(regressionLine.m, regressionLine.b, -1), lineEq(regressionLine.m, regressionLine.b, 15)],
        mode: 'lines',
        type: 'scatter',
        name: ' of Best Fit'
      };
      
      var layout = {
        title: 'Nitrate vs Cancer Rate',
        xaxis: {title: 'Nitrate (ppm)'},
        yaxis: {title: 'Cancer Rate'},
        showlegend: false
      };

      var data = [trace2, trace1]; 
      
    Plotly.newPlot(ctx, data, layout);
    var r2 = computeR2(regressionLine.m, regressionLine.b, nitrArray, canArray);

    document.getElementById("regression-text").innerHTML += "<p> RMSE = " + r2;
    document.getElementById("regression-text").innerHTML +=   "This value of root mean-squared error implies very little linear correlation between the nitrate and cancer levels.</p>";
};

function computeR2(slope, intercept, input, output){
    
    let regError = 0;
    let totalErr = 0;

    let mean = output.reduce((a,b) => a + b) / output.length;

    for (let i = 0; i<input.length; i++) {
        regError += Math.pow(output[i] - prediction(slope, intercept, input[i]), 2);
        totalErr += Math.pow(output[i]-mean, 2);
    }

    return 1 - (regError / totalErr);
};

function prediction(slope, intercept, input) {
    
    return intercept + slope * input;
}

function lineEq(slope, intercept, input){
    var output = (input * slope) + intercept;
    return output;
};

// document.addEventListener('DOMContentLoaded', loadMap);