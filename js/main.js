$(window).on('load', function() { // makes sure the whole site is loaded 
    $('#preloader').fadeOut('slow',function(){$(this).remove();});
});

$(document).ready(function() {
  $.ajaxSetup({ cache: false });
  loadLayerConfig();
  initDrawSaveButton();
});

//Init BaseMaps
var basemaps = {
  "OpenStreetMaps": L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      minZoom: 2,
      maxZoom: 19,
      id: "osm.streets"
    }
  ),
  "Google-Map": L.tileLayer(
    "https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}",
    {
      minZoom: 2,
      maxZoom: 19,
      id: "google.street"
    }
  ),
  "Google-Satellite": L.tileLayer(
    "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    {
      minZoom: 2,
      maxZoom: 19,
      id: "google.satellite"
    }
  ),
  "Google-Hybrid": L.tileLayer(
    "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    {
      minZoom: 2,
      maxZoom: 19,
      id: "google.hybrid"
    }
  ),
  "Six-Aerial": L.tileLayer(
    "http://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      minZoom:2,
      maxZoom:20,
      id:'six.aerial'
    }
  )
};

//Init Overlays
var overlays = {};

//Render Main Map
var map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  center: [30.052, 77.019],
  zoom: 10,
  editable: true,
  layers: [basemaps.OpenStreetMaps]
});

//Init Zoom Control
L.control.zoom({
  position: "topleft"
}).addTo(map);

//Init Sidebar Control
var sidebar = L.control.sidebar({
  autopan: false,
  container: "sidebar",
  position: "right"
}).addTo(map);

//Init Layer Control
var layerControl = L.control.layers(
  basemaps, 
  overlays, 
  {
    position: "topright",
    collapsed: false
  }
).addTo(map);

//Move Layers control to sidebar
var layerControlContainer = layerControl.getContainer();
$("#layercontrol").append(layerControlContainer);
$(".leaflet-control-layers-list").prepend("<strong class='title'>Base Maps</strong><br>");
$(".leaflet-control-layers-separator").after("<br><strong class='title'>Layers</strong><br>");

//Handle Map click to Display Lat/Lng
map.on('click', function(e) {
  $("#latlng").html(e.latlng.lat + ", " + e.latlng.lng);
	$("#latlng").show();
});

//Handle Copy Lat/Lng to clipboard
$('#latlng').click(function(e) {
  var $tempElement = $("<input>");
	$("body").append($tempElement);
	$tempElement.val($("#latlng").text()).select();
	document.execCommand("Copy");
	$tempElement.remove();
	alert("Copied: "+$("#latlng").text());
	$("#latlng").hide();
});

//Init Editable(Cosmetic) Layer for Leaflet Draw
var editableLayers = new L.FeatureGroup().addTo(map);
layerControl.addOverlay(editableLayers, "Cosmetic Layer");

//Init Leaflet Draw
var drawControl = new L.Control.Draw({
  position: "topleft",
  draw: {
    polyline: true,
    polygon: {
      allowIntersection: false, // Restricts shapes to simple polygons
      drawError: {
        color: "#e1e100", // Color the shape will turn when intersects
        message: "<strong>Oh snap!<strong> you can't draw that!" // Message that will show when intersect
      }
    },
    circle: true,
    rectangle: true,
    circlemarker: false, // Turns off this drawing tool
    marker: true
  },
  edit: {
    featureGroup: editableLayers, //REQUIRED!!
    remove: true
  }
}).addTo(map);

//On Draw Create Event
map.on(L.Draw.Event.CREATED, function(e) {
  var type = e.layerType,
    layer = e.layer;

  if (type === "marker") {
    layer
      .bindPopup(
        "LatLng: " + layer.getLatLng().lat + "," + layer.getLatLng().lng
      )
      .openPopup();
  }

  editableLayers.addLayer(layer);
  console.log("Draw Create", JSON.stringify(editableLayers.toGeoJSON()));
  /*$(".drawercontainer .drawercontent").html(
    JSON.stringify(editableLayers.toGeoJSON())
  );*/
});

//On Draw Edit Event
map.on(L.Draw.Event.EDITED, function(e) {
  console.log("Draw Edit", JSON.stringify(editableLayers.toGeoJSON()));
  editableLayers.removeLayer(selectedFeature);
  /*$(".drawercontainer .drawercontent").html(
    JSON.stringify(editableLayers.toGeoJSON())
  );*/
});

//On Draw Delete Event
map.on(L.Draw.Event.DELETED, function(e) {
  console.log("Draw Delete", JSON.stringify(editableLayers.toGeoJSON()));
  //$(".drawercontainer .drawercontent").html("");
});

var drawEditMode = false;

//Edit Button Clicked
$('#toggledraw').click(function(e) {
  getSelectedLayers();
  if($(".leaflet-draw").is(":hidden"))
  {
    drawEditMode = true;
    $(this).find("i").css("color","rgb(0, 255, 0)");
    //console.log($(this).find("i::before").css("color"));
  }
  else
  {
    drawEditMode = false;
    $(this).find("i").css("color","rgb(255, 255, 255)");
  }
  $(".leaflet-draw").fadeToggle("fast", "linear");
  $(".leaflet-draw-toolbar").fadeToggle("fast", "linear");
  this.blur();
  return false;
});

//Init Map Bounds
var mapBounds=map.getBounds();
var bounds= new L.latLngBounds();

//Init Feature Selection
var selectedFeature = null;
var previousSelectedFeature = null;
var parentLayer = null;

//Load Layer Config
function loadLayerConfig() {
  $.getJSON("layers.json", function(data) {}).done(function( data ) {
    $.each( data.layers, function( i, layer ) {
      //console.log("Config Layer: "+layer.name+" Enabled: "+layer.enabled+" Visible: "+layer.visible);
      if(layer.enabled!="false") 
      {
        $.getJSON(layer.geojson, function(data) { 
          addDataToMap(data, map, layer.name, layer.visible); 
        });
      }
    });
  });
}

//Map GeoJSON Feature Handler
function addDataToMap(data, map, layername, layervisible) {
  var dataLayer = L.geoJson(
    data, 
    {
      //Render GeoJSON Style Properties
      style: function(feature) {
        return {
          fillColor: feature.properties['fill'],
          fillOpacity: feature.properties['fill-opacity'],
          color: feature.properties['stroke'],
          width: feature.properties['stroke-width'],
          opacity: feature.properties['opacity']
        }
      },
      //Add Handlers for each feature
      onEachFeature: function(feature, layer) {
        //Bind ToolTip and Popup to each feature
        if(typeof feature.properties.description != "undefined")
        {
          layer.bindTooltip(feature.properties.description,layer);
          //layer.bindPopup(feature.properties.description,layer);
        }
        else if(typeof feature.properties.name != "undefined")
        {
          layer.bindTooltip(feature.properties.name,layer);
          //layer.bindPopup(feature.properties.name,layer);
        }
        else
        {
          layer.bindTooltip("Layer: "+L.stamp(layer),layer);
        }

        //Layer Event Handlers
        layer.on({
          'mouseover': function (e) {
            if (layer.options.color != '#FFFF00') {
              e.target.setStyle({
                weight: 5,
                fillColor: "#FFFF00",
                fillOpacity: 0.4
              });
            
              if (!L.Browser.ie && !L.Browser.opera) {
                e.target.bringToFront();
              }
            }
          },
          'mouseout': function (e) {
            if (layer.options.color != '#FFFF00') {
                dataLayer.resetStyle(e.target);
            }
          },
          'click': function (e) {
            if (layer.options.color == '#FFFF00') {
              //Do De-seselect
              dataLayer.resetStyle(e.target);
              e.target.feature.properties.selected = false;
              if(e.target.editEnabled()) {
                e.target.disableEdit();
              }
              //console.log("deselected " + e.target.feature.properties.description);
            }
            else
            {
              //Do Select
              layer.setStyle({
                weight: 5,
                color: "#FFFF00"
              });

              //console.log("selected " + e.target.feature.properties.name);

              e.target.feature.properties.selected = true;
              map.fitBounds(e.target.getBounds());
              if(drawEditMode) {
                e.target.enableEdit();
              }
            }

            setSelectedLayers();
					
            if (!L.Browser.ie && !L.Browser.opera) {
                layer.bringToFront();
            }
          }
        });
      }
    }
  );

  //Handle Layer Visibility
  if(layervisible!="false")
  {
    bounds.extend(dataLayer.getBounds());
    map.fitBounds(bounds);
    //map.setMaxBounds(bounds);
    overlays[layername] = L.layerGroup();
    overlays[layername].addLayer(dataLayer);
    overlays[layername].addTo(map);
  }
  else
  {
    bounds.extend(dataLayer.getBounds());
    map.fitBounds(bounds);
    //map.setMaxBounds(bounds);
    overlays[layername] = L.layerGroup();
    overlays[layername].addLayer(dataLayer);
  }

  //Add Layer to Layer Control
  layerControl.addOverlay(overlays[layername], layername);
}

var selectedFeatureName = [];

function setSelectedLayers() {
  selectedFeatureName = [];
  $.each(map._layers, function (ml) {
    if (map._layers[ml].feature && map._layers[ml].feature.properties.selected === true) {
      selectedFeatureName.push(map._layers[ml]);
    }
  });
  //console.log(selectedFeatureName);
  //$('#selectedFeatures').text( selectedFeatureName );
  //$('#selectedCount').text( selectedFeatureName.length );
};

function getSelectedLayers() {
  $.each(selectedFeatureName, function (ml) {
    if (selectedFeatureName[ml].feature && selectedFeatureName[ml].feature.properties.selected === true) {
      if(selectedFeatureName[ml].editEnabled()) {
        selectedFeatureName[ml].disableEdit();
      }  
      else
      {
        selectedFeatureName[ml].enableEdit();
      }
    }
  });
  //console.log(selectedFeatureName);
  //$('#selectedFeatures').text( selectedFeatureName );
  //$('#selectedCount').text( selectedFeatureName.length );
};

//Draw Export Layer Button
function initDrawSaveButton() {
  var saveFileElem = '<a class="leaflet-draw-edit-edit leaflet-disabled" href="javascript:ExportGeoJSON();" id="ExportGeoJSON" title="No layers to Save"><span class="sr-only">Save layers to file</span></a>';
  $("#map > div.leaflet-control-container > div.leaflet-top.leaflet-left > div.leaflet-draw.leaflet-control > div:nth-child(2) > div").append(saveFileElem);
}

//Draw Export Layer Handler
function ExportGeoJSON() {
  if($(".leaflet-draw-edit-edit").hasClass("leaflet-disabled"))
  {
    alert("Nothing to save!");
    return false;
  }
  else
  {
     // Extract GeoJson from featureGroup
    var data = editableLayers.toGeoJSON();

    // Stringify the GeoJson
    var convertedData = new Blob([JSON.stringify(data)], {type: "text/plain;charset=utf-8"});
    saveAs(convertedData, "data.geojson");
  }
}

function updateDrawTools()
{
  if($(".leaflet-draw-edit-edit").first().hasClass('leaflet-disabled'))
  {
    $("#ExportGeoJSON").attr("title", "No Layers to Export")
    $("#ExportGeoJSON").addClass("leaflet-disabled");
  }
  else
  {
    $("#ExportGeoJSON").attr("title", "Export Layers to GeoJSON")
    $("#ExportGeoJSON").removeClass("leaflet-disabled");
  }
}

setInterval(updateDrawTools, 1000);