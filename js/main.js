// Declare map, infoWindow and bounds as global variables
var map;
var infoWindow;
var bounds;

// Initialize google maps to display a map of Reno, NV
function initMap() {
    var reno = {
        lat: 39.544870,
        lng: 119.815957
    };
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 5,
        center: reno,
        mapTypeControl: false
    });

    infoWindow = new google.maps.InfoWindow();

    bounds = new google.maps.LatLngBounds();
   
    ko.applyBindings(new ViewModel());
}

//  Set alert for map error
function googleMapsError() {
    alert('Google Maps is not working properly.  Please check your internet connection.');
}

/*  Set the Location Model */ 
var LocationMarker = function(data) {
    var self = this;

    this.title = data.title;
    this.position = data.location;
    this.street = '',
    this.city = '',
    this.phone = '',
    
    this.visible = ko.observable(true);

    // Insert marker colors and styles.  First one is the listing marker icon.
    var defaultIcon = makeMarkerIcon('FF4500');
    // Second marker to highlight location with a contrasting marker color for when user
    // moves over marker.
    var highlightedIcon = makeMarkerIcon('32CD32');
    // Insert Foursquare client ID and clientSecret
    var clientID = 'ZKZ5QP1TWUQHRUQ0YWJTIBC32PHPDPZCEIVXEGCRZVSVNHHP';
    var clientSecret = 'IGYJ1Z3GT2XALBQOI03VWV2ZUBKBZKXBQHLVEMWAWM5XKSI5';

    // get JSON request of foursquare data
    var reqURL = 'https://api.foursquare.com/v2/venues/search?ll=' + this.position.lat + ',' + 
                 this.position.lng + '&client_id=' + clientID + '&client_secret=' + clientSecret + 
                 '&v=20170320' + '&query=' + this.title;

    $.getJSON(reqURL).done(function(data) {
        var results = data.response.venues[0];
        self.street = results.location.formattedAddress[0] ? results.location.formattedAddress[0]: 'N/A';
        self.city = results.location.formattedAddress[1] ? results.location.formattedAddress[1]: 'N/A';
        self.phone = results.contact.formattedPhone ? results.contact.formattedPhone : 'N/A';
    }).fail(function() {
        alert('Something went wrong with foursquare');
    });

    // Create markers for locations, and put them into an array
    this.marker = new google.maps.Marker({
        position: this.position,
        title: this.title,
        animation: google.maps.Animation.DROP,
        icon: defaultIcon
    });    

    self.filterMarkers = ko.computed(function () {
    // Set the marker and extend the bounds for showListings
        if(self.visible() === true) {
            self.marker.setMap(map);
            bounds.extend(self.marker.position);
            map.fitBounds(bounds);
        } else {
            self.marker.setMap(null);
        }
    });
    
    // Set an onclick event to open an infowindow for each unique marker
    this.marker.addListener('click', function() {
        populateInfoWindow(this, self.street, self.city, self.phone, infoWindow);
        toggleBounce(this);
        map.panTo(this.getPosition());
    });

    // Create two event listeners, first for the mouseover, second for the mouseout,
    // to change the colors, making it evident which one is selected.
    this.marker.addListener('mouseover', function() {
        this.setIcon(highlightedIcon);
    });
    this.marker.addListener('mouseout', function() {
        this.setIcon(defaultIcon);
    });

    // When an item is selected from a list with a click, it triggers an event
    this.show = function(location) {
        google.maps.event.trigger(self.marker, 'click');
    };

    // When an item is selected, it makes the marker appear to bounce.
    this.bounce = function(place) {
        google.maps.event.trigger(self.marker, 'click');
    };

};

/* Set the View Model */
var ViewModel = function() {
    var self = this;

    this.searchItem = ko.observable('');

    this.mapList = ko.observableArray([]);

    // Put location markers in place for every listed location
    locations.forEach(function(location) {
        self.mapList.push( new LocationMarker(location) );
    });

    // Function to automatically update location based on search text in the search field & make it so locations can be viewed on the map. It updates the sidelist and the visible markers based on what user filters.
    this.locationList = ko.computed(function() {
        var searchFilter = self.searchItem().toLowerCase();
        if (searchFilter) {
            return ko.utils.arrayFilter(self.mapList(), function(location) {
                var str = location.title.toLowerCase();
                var result = str.includes(searchFilter);
                location.visible(result);
                return result;
            });
        }
        self.mapList().forEach(function(location) {
            location.visible(true);
        });
        return self.mapList();
    }, self);
};

// Populate an infowindow when a marker is clicked. 
// Only one infowindow is allowed, which will open at the marker that is clicked, 
// and will show info based on that marker's position.
function populateInfoWindow(marker, street, city, phone, infowindow) {
    // Check that infowindow is not already opened on this marker.
    if (infowindow.marker != marker) {
        // Clear infowindow content to give streetview time to load.
        infowindow.setContent('');
        infowindow.marker = marker;

        // Clear marker property if the infowindow is closed.
        infowindow.addListener('closeclick', function() {
            infowindow.marker = null;
        });
        var streetViewService = new google.maps.StreetViewService();
        var radius = 60;

        var windowContent = '<h4>' + marker.title + '</h4>' + 
            '<p>' + street + "<br>" + city + '<br>' + phone + "</p>";

        // If the status is OK, which means the pano was found, compute the
        // position of the streetview image, then calculate the heading, get a
        // panorama from that, and set the options
        var getStreetView = function (data, status) {
            if (status == google.maps.StreetViewStatus.OK) {
                var nearStreetViewLocation = data.location.latLng;
                var heading = google.maps.geometry.spherical.computeHeading(
                    nearStreetViewLocation, marker.position);
                infowindow.setContent(windowContent + '<div id="pano"></div>');
                var panoramaOptions = {
                    position: nearStreetViewLocation,
                    pov: {
                        heading: heading,
                        pitch: 20
                    }
                };
                var panorama = new google.maps.StreetViewPanorama(
                    document.getElementById('pano'), panoramaOptions);
            } else {
                infowindow.setContent(windowContent + '<div style="color: purple">Street View Unavailable</div>');
            }
        };
        // GoogleMaps streetview service gets the closest streetview image 
        // within 60 meters of the marked position
        streetViewService.getPanoramaByLocation(marker.position, radius, getStreetView);
        // Open the infowindow on the correct marker.
        infowindow.open(map, marker);
    }
}
//  Makes the marker bounce for 2 seconds
function toggleBounce(marker) {
  if (marker.getAnimation() !== null) {
    marker.setAnimation(null);
  } else {
    marker.setAnimation(google.maps.Animation.BOUNCE);
    setTimeout(function() {
        marker.setAnimation(null);
    }, 2000);
  }
}

// Function takes in a color, and creates a new marker
// icon of that color. The icon will be 25 px wide by 38 high, have an origin
// of (0, 0) and be anchored at (10, 34).
function makeMarkerIcon(markerColor) {
    var markerImage = new google.maps.MarkerImage(
        'http://chart.googleapis.com/chart?chst=d_map_spin&chld=1.15|0|' + markerColor +
        '|40|_|%E2%80%A2',
        new google.maps.Size(25, 38),
        new google.maps.Point(0, 0),
        new google.maps.Point(10, 34),
        new google.maps.Size(25, 38));
    return markerImage;
}
