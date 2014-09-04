// History and navigation management
(function (window, undefined) {
  // Establish Variables
  var History = window.History;
  History.debug.enable = true;

  // Bind to State Change
  History.Adapter.bind(window, 'statechange', function () {
    var state = History.getState();
    if (typeof state.data.route !== "undefined") {
      router.route(state.data.route, state.data);
    } else {
      router.route("index");
    }
  });
}(window));

var uri_split_chars = "\t::\t";
var uri_split = function(combinedURIs) {
  return combinedURIs.split(uri_split_chars);
};
var uri_combine = function(ont_uri, cls_uri) {
  return ont_uri + uri_split_chars + cls_uri;
};


var bpResourceIndexEmbedded = false;
jQuery(document).ready(function () {
  bpResourceIndexEmbedded = (jQuery("#resource_table").parents("div.resource_index_embed").length > 0);
  // Hide/Show resources
  jQuery(".resource_link").live("click", function (event) {
    event.preventDefault();
    switchResources(this);
  });

  // Spinner for pagination
  jQuery(".pagination a").live("click", function () {
    jQuery(this).parents("div.pagination").append('&nbsp;&nbsp; <span style="font-size: small; font-weight: normal;">loading</span> <img style="vertil-align: text-bottom;" src="/images/spinners/spinner_000000_16px.gif">');
  });

  // Make chosen work via ajax
  if (jQuery("#resource_index_classes").length > 0) {
    jQuery("#resource_index_classes").ajaxChosen({
      minLength    : 3,
      queryLimit   : 10,
      delay        : 500,
      chosenOptions: {},
      searchingText: "Searching for concept ",
      noresultsText: "Concepts not found",
      initialQuery : false
    }, function (options, response, event) {
      // jQuery("#resource_index_classes_chzn .chzn-results li.active-result").remove();
      var format = 'json';
      var search_url = jQuery(document).data().bp.config.rest_url+"/search"; // direct REST API
      var search_term = jQuery.trim(options.term);
      if (/[^*]$/.test(search_term)) {
        search_term += '*';
      }
      var search_params = {};
      search_params['q'] = search_term;
      search_params['format'] = format;
      search_params['apikey'] = jQuery(document).data().bp.config.apikey;
      // NOTE: disabled ontologies selection in the UI, ensure it has no value here.
      // NOTE: ontologies are specified in resource_index_controller::search_classes
      //search_params['ontologies'] = currentOntologyAcronyms().join(',');
      jQuery.ajax({
        url: search_url,
        data: search_params,
        dataType: format,
        success: function(data){
          jQuery("#search_spinner").hide();
          jQuery("#search_results").show();
          var classes = {}, classHTML = "";
          jQuery.each(data.collection, function (index, cls) {
            var cls_id = cls["@id"];
            var ont_id = cls.links.ontology;
            var ont_name = ont_id.split('/').slice(-1)[0];
            classHTML = "" +
              "<span class='search_ontology' title='" + ont_id + "'>" +
                "<span class='search_class' title='" + cls_id + "'>" +
                  markupClass(cls).prop('outerHTML') +
                  "<span class='search_ontology_acronym'>(" + ont_name + ")</span>" +
              "</span>";
            // Create a combination of ont_id and cls_id that can be split when retrieved.
            // This will be the option value in the selected drop-down list.
            var combined_uri = uri_combine(ont_id, cls_id);
            classes[combined_uri] = classHTML;
          });
          response(classes);  // Chosen plugin creates select list.
        },
        error: function(){
          jQuery("#search_spinner").hide();
          jQuery("#search_results").hide();
          jQuery("#search_messages").html("<span style='color: red'>Problem searching, please try again");
        }
      });
    });
  }

  function markupClass(cls) {
    // Wrap the class prefLabel in a span, indicating that the class is obsolete if necessary.
    var max_word_length = 60;
    var label_text = (cls.prefLabel.length > max_word_length) ? cls.prefLabel.substring(0, max_word_length) + "..." : cls.prefLabel;
    var label_html = jQuery("<span/>").addClass('prefLabel').append(label_text);
    if (cls.obsolete === true){
      label_html.removeClass('prefLabel');
      label_html.addClass('obsolete_class');
      label_html.attr('title', 'obsolete class');
    }
    return label_html; // returns a jQuery object; use .prop('outerHTML') to get markup text.
  }

  // If all classes are removed from the search, put the UI in base state
  jQuery("a.search-choice-close").live("click", function () {
    if (chosenSearchClassesArgs() === null) {
      pushIndex();
      var input = document.activeElement
      jQuery("#resource_index_classes_chzn").trigger("mousedown");
      input.blur();
      jQuery("#resource_index_classes_chzn input").data("prevVal", "");
      jQuery("#resource_index_classes_chzn .chzn-results li").remove();
    }
  });

  // Get search results
  if (jQuery("#resource_index_button").length > 0) {
    jQuery("#resource_index_button").click(function () {
      var url = "/resource_index/resources?" + chosenSearchClassesArgs();
      pushDisplayResources(url, {classes: chosenSearchClasses()});
      getSearchResults();
    });
  }

  // Show/Hide results with zero matches
  jQuery("#show_hide_no_results").live("click", function () {
    jQuery("#resource_table .zero_results").toggleClass("not_visible").effect("highlight", { color: "yellow" }, 500);
    jQuery("#show_hide_no_results .show_hide_text").toggleClass("not_visible");
  });

  jQuery(".show_element_details").live("click", function (e) {
    e.preventDefault();
    var el = jQuery(this);
    var cleanElementId = el.attr("data-clean_element_id");
    var el_text = jQuery("#" + cleanElementId + "_text");
    el_text.toggleClass("not_visible");
    if (el_text.attr("highlighted") !== "true") {
      var element = new Element(el.attr("data-element_id"), cleanElementId, chosenSearchClasses(), el.attr("data-resource_id"));
      el.parent().append("<span id='" + element.cleanId + "_ani'class='highlighting'>highlighting... <img style='vertical-align: text-bottom;' src='/images/spinners/spinner_000000_16px.gif'></span>");
      element.highlightAnnotationPositions();
      el_text.attr("highlighted", "true");
    }
  });
});

// Get parameters from the URL
var BP_urlParams = {};
(function () {
  var match, hashParamMatch, paramHash,
    pl = /\+/g,  // Regex for replacing addition symbol with a space
    search = /([^&=]+)=?([^&]*)/g,
    decode = function (s) {
      return decodeURIComponent(s.replace(pl, " "));
    },
  query = window.location.search.substring(1);
  queryH = window.location.hash.substring(1);

  while (match = search.exec(query)) {
    if (hashParamMatch = /^(\w+)\[(.*)\]$/.exec(match[1])) {
      paramHash = BP_urlParams[hashParamMatch[1]];
      if (paramHash === undefined) {
        paramHash = {};
      }
      if (paramHash[decode(hashParamMatch[2])] === undefined) {
        paramHash[decode(hashParamMatch[2])] = [];
      }
      paramHash[decode(hashParamMatch[2])].push(decode(match[2]));
      BP_urlParams[hashParamMatch[1]] = paramHash;
    } else {
      BP_urlParams[decode(match[1])] = decode(match[2]);
    }
  }

  while (match = search.exec(queryH)) {
    if (hashParamMatch = /^(\w+)\[(.*)\]$/.exec(match[1])) {
      paramHash = BP_urlParams[hashParamMatch[1]];
      if (paramHash === undefined) {
        paramHash = {};
      }
      if (paramHash[decode(hashParamMatch[2])] === undefined) {
        paramHash[decode(hashParamMatch[2])] = [];
      }
      paramHash[decode(hashParamMatch[2])].push(decode(match[2]));
      BP_urlParams[hashParamMatch[1]] = paramHash;
    } else {
      BP_urlParams[decode(match[1])] = decode(match[2]);
    }
  }
})();

function pageInit() {
  var state = History.getState();
  var params = {}, paramLocations = ["root", "resources", "acronym"], route, queryString;
  route = state.hash.split("?");
  queryString = (typeof route[1] !== "undefined") ? "" : route[1];
  route = route[0].split("/").slice(1);
  for (var i = 0; i < route.length; i++) {
    params[paramLocations[i]] = route[i];
  }
  jQuery.extend(params, BP_urlParams);
  BP_urlParams = params;
  if (typeof params["acronym"] !== "undefined" && params["acronym"] !== "search") {
    router.route("resource", params);
  } else if (typeof params["resources"] !== "undefined") {
    router.route("resources", params);
  }
}

function pushDisplayResource(url, params) {
  var route = "resource";
  if (bpResourceIndexEmbedded) {
    router.route(route, params);
  } else {
    params["route"] = route;
    History.pushState(params, document.title, url);
  }
}

function pushDisplayResources(url, params) {
  var route = "resources";
  if (bpResourceIndexEmbedded) {
    router.route(route, params);
  } else {
    params["route"] = route;
    History.pushState(params, document.title, url);
  }
}

function pushIndex() {
  var route = "index";
  if (bpResourceIndexEmbedded) {
    router.route(route);
  } else {
    History.pushState(null, document.title, "/resource_index");
  }
}

function replaceIndex() {
  var route = "index";
  if (bpResourceIndexEmbedded) {
    router.route(route);
  } else {
    History.replaceState(null, document.title, "/resource_index");
  }
}

// This will look up any class labels that haven't already been processed. If there are none it just exits without doing anything.
// To decrease ajax calls, we also use the bp_classes_cache. This method is used via polling.
var bp_classes_cache = {};
function lookupClassLabels() {
  jQuery("#resource_results a.ri_concept[data-applied_label='false']").each(function () {
    var link = jQuery(this);
    var params = { conceptid: decodeURIComponent(link.data("concept_id")), ontologyid: link.data("ontology_id") };
    link.attr("data-applied_label", "true");

    // Check to see if another thread is already making an ajax request and start polling
    if (bp_classes_cache[params.ontologyid + "/" + params.conceptid] === "getting") {
      return setTimeout((function () {
        return applyClassLabel(link, params);
      }), 100);
    }

    if (typeof bp_classes_cache[params.ontologyid + "/" + params.conceptid] === "undefined") {
      bp_classes_cache[params.ontologyid + "/" + params.conceptid] = "getting";
      jQuery.ajax({
        url     : "/ajax/json_class",
        data    : params,
        dataType: 'json',
        success : (function (link) {
          return function (data) {
            bp_classes_cache[params.ontologyid + "/" + params.conceptid] = data;
            if (data !== null) jQuery(link).html(data.prefLabel);
          }
        })(this)
      });
    }
  })
}

// Poll for class information
jQuery(document).ready(function () {
  setInterval((function () {
    lookupClassLabels();
  }), 1000);
});

// This function will poll to see if class information exists
function applyClassLabel(link, params, calledAgain) {
  var class_info = bp_classes_cache[params.ontologyid + "/" + params.conceptid];
  if (class_info === "getting") {
    if (typeof calledAgain !== "undefined") calledAgain = 0
    return setTimeout((function () {
      return applyClassLabel(link, params, calledAgain += 1);
    }), 100);
  }
  if (class_info !== null) jQuery(link).html(class_info.prefLabel);
}

function Router() {
  this.route = function (route, params) {
    switch (route) {
      case "index":
        this.index();
        break;
      case "resource":
        this.resource(params);
        break;
      case "resources":
        this.resources(params);
        break;
    }
  };

  this.index = function () {
    jQuery("#results").html("");
    jQuery("#results_error").html("");
    jQuery("#initial_resources").show();
    jQuery("#resource_index_classes_chzn .search-choice-close").click();
  };

  this.resource = function (params) {
    if (typeof params["classes"] === "undefined" || typeof params["acronym"] === "undefined") {
      replaceIndex();
    }
    displayResource(params);
  };

  this.resources = function (params) {
    if (typeof params["classes"] === "undefined") {
      replaceIndex();
    }
    displayResources(params["classes"]);
  };

}
router = new Router();

function displayResource(params) {
  var resource = params["acronym"];
  if (resource === undefined || resources[resource] === undefined) {
    return;
  }
  var name = resources[resource].name;
  // Only retrieve class information if this is an initial load
  if (jQuery("#resource_index_classes").val() !== null) {
    showResourceResults(resource, name);
    return;
  }
  displayClasses(params["classes"], function () {
    showResourceResults(resource, name);
  });
}

function displayResources(classes) {
  // Only retrieve class information if this is an initial load
  if (jQuery("#resource_index_classes").val() !== null) {
    showAllResources();
    return;
  }
  displayClasses(classes);
}

function displayClasses(classes, completedCallback) {
  var concept, conceptOpt, ontologyId, conceptId, ontologyName, conceptsLength, params, ontClasses, chsnValue,
      conceptRetreivedCount = 0,
      ontClassPairs = [];

  for (ontology in classes) {
    ontClasses = classes[ontology];
    for (var i = 0; i < ontClasses.length; i++) {
      ontClassPairs.push([ontology, ontClasses[i]]);
    }
  }
  conceptsLength = ontClassPairs.length;

  jQuery("#resource_index_classes").html("");
  for (var i = 0; i < ontClassPairs.length; i++) {
    ontClassPair = ontClassPairs[i];
    ontologyId = ontClassPair[0];
    ontologyAcronym = ontClassPair[0].split("/").slice(-1)[0];
    conceptId = ontClassPair[1];
    ontologyName = ont_names[ontologyId];
    params = { ontologyid: ontologyAcronym, conceptid: conceptId };
    chsnValue = ontologyId + uri_split_chars + conceptId;
    jQuery.getJSON("/ajax/json_class", params, (function (ontologyAcronym, chsnValue) {
      return function (data) {
        jQuery("#resource_index_classes")
            .append(jQuery("<option/>")
            .attr("selected", true)
            .val(chsnValue)
            .html(" " + data.prefLabel + " <span class='search_ontology_acronym'>(" + ontologyAcronym + ")</span>"));
        conceptRetreivedCount += 1;
        if (conceptRetreivedCount == conceptsLength) {
          updateChosen();
          getSearchResults(completedCallback);
        }
      }
    })(ontologyAcronym, chsnValue));
  }
}

function updateChosen() {
  jQuery("#resource_index_classes").trigger("liszt:updated");
  jQuery("#resource_index_classes").trigger("change");
}

function getSearchResults(success) {
  jQuery("#results_error").html("");
  jQuery("#resource_index_spinner").show();
  jQuery("#results.contains_search_results").hide();
  var params = {
    'classes': chosenSearchClasses() // ontologyURI: [classURI, classURI, ... ]
  };
  jQuery.ajax({
    type    : 'POST',
    url     : "/resource_index",
    data    : params,
    dataType: 'html',
    success : function (data) {
      jQuery("#results").html(data);
      jQuery("#results").addClass("contains_search_results");
      jQuery("#results.contains_search_results").show();
      jQuery("#results_container").show();
      jQuery("#resource_index_spinner").hide();
      if (success && typeof success === "function") {
        success();
      }
      jQuery("#initial_resources").hide();
      jQuery("#resource_table table").dataTable({
        "bPaginate": false,
        "bFilter"  : false,
        "aoData"   : [
          { "sType": "html" },
          { "sType": "html-formatted-num", "asSorting": [ "desc", "asc"] },
          { "sType": "percent", "asSorting": [ "desc", "asc"] },
          { "sType": "html-formatted-num", "asSorting": [ "desc", "asc"] }
        ]
      });
      // Update result counts for resources with matches
      updateCounts();
    },
    error   : function () {
      jQuery("#resource_index_spinner").hide();
      jQuery("#results_error").html("Problem retrieving search results, please try again");
    }
  })
}

function updateCounts() {
  var hiddenRows, totalRows, visibleRows;
  hiddenRows = jQuery("#resource_table table tbody tr.not_visible").length;
  totalRows = jQuery("#resource_table table tbody tr").length;
  visibleRows = totalRows - hiddenRows;
  jQuery("#result_counts").html("matches in " + visibleRows + " of " + totalRows + " resources")
}

jQuery("a.results_link").live("click", function (event) {
  var resource = jQuery(this).data("resource_id");
  //var name = jQuery(this).data("resource_name");
  var url = "/resource_index/resources/" + resource + "?" + chosenSearchClassesArgs();
  pushDisplayResource(url, {classes: chosenSearchClasses(), acronym: resource});
});

jQuery("a#show_all_resources").live("click", function () {
  var url = "/resource_index/resources?" + chosenSearchClassesArgs();
  pushDisplayResources(url, {classes: chosenSearchClasses()});
});

function showResourceResults(resource, name) {
  jQuery("#resource_info_" + resource).find("a.resource_results_ajax").addClass("get_via_ajax");
  jQuery(".resource_info").addClass("not_visible");
  jQuery("#resource_table").addClass("not_visible");
  jQuery("#resource_info_" + resource).removeClass("not_visible");
  jQuery("#resource_title").html(name);
  jQuery(".resource_title").removeClass("not_visible");
  jQuery("#resource_title").removeClass("not_visible");
  updateCounts();
}

function showAllResources() {
  jQuery(".resource_info").addClass("not_visible");
  jQuery(".resource_title").addClass("not_visible");
  jQuery("#resource_title").addClass("not_visible");
  jQuery("#resource_table").removeClass("not_visible");
  updateCounts();
}

function Element(id, cleanId, classes, resource) {
  this.positions;
  this.id = id;
  this.cleanId = cleanId;
  this.jdomId = "#" + cleanId + "_text";
  this.classes = classes;
  this.resource = resource;
  this.loadAni = null;

  this.highlightAnnotationPositions = function () {
    var element = this;
    var text_map = {};
    jQuery(this.jdomId + " .element_text p").each(function(){
      var p = jQuery(this);
      text_map[p.attr("data-context_name")] = p.html();
    });
    jQuery.ajax({
      url     : "/resource_index/element_annotations?"+chosenSearchClassesArgs(this.classes),
      data    : {
        elementid : this.id,
        element_text: text_map,
        acronym: this.resource
      },
      dataType: "json",
      type: "POST",
      success : function (data) {
        element.positions = data;
        element.highlight();
      }
    });
  }

  this.highlight = function () {
    var element = this;
    jQuery.each(this.positions, function(contextName, positions) {
      var context = jQuery(element.jdomId + " p[data-context_name=" + contextName + "]");
      if (positions.length > 0) {
        highlighter = new PositionHighlighter();
        // Replace the current text with highlighted version
        context.html(highlighter.highlightUsingPosition(context.html(), positions));
      }
    });
    jQuery("#" + this.cleanId + "_link").find(".highlighting").remove();
    if (this.loadAni !== null) {
      clearInterval(this.loadAni);
    }
  }
}

function PositionHighlighter() {
  this.offsetPositions = [];
  this.textToHighlight = "";

  this.highlightUsingPosition = function (text, positions) {
    // This is stupid, but annotator/resource index output starts counting text at one
    var start = 1;
    var end = text.length;
    var positionsLength = positions.length;
    var highlightType, startPosition, endPosition;

    // We do this to decode HTML entities
    this.textToHighlight = jQuery("<div/>").html(text).text();

    // Starting offsets should be zero
    for (var i = start; i <= end; i++) {
      this.offsetPositions[i] = 0;
    }

    for (var j = 0; j < positionsLength; j++) {
      highlightType = positions[j]['type'] || "direct";
      startPosition = positions[j]['from'];
      endPosition = positions[j]['to'];

      // Add the highlight opener
      this.addText("<span class='" + highlightType + "'>", startPosition, -1);
      // Add the highlight closer
      this.addText("</span>", endPosition, 0);
    }

    return this.textToHighlight;
  }

  this.updatePositions = function (start, added_count) {
    var offset_length = this.offsetPositions.length;
    for (var i = start; i <= offset_length; i++) {
      this.offsetPositions[i] += added_count;
    }
  }

  this.addText = function (textToAdd, position, offset) {
    this.textToHighlight = [this.textToHighlight.slice(0, this.getActualPosition(position) + offset), textToAdd, this.textToHighlight.slice(this.getActualPosition(position) + offset)].join('');
    this.updatePositions(position, textToAdd.length);
  }

  this.getActualPosition = function (position) {
    return position + this.offsetPositions[position];
  }
}

function currentOntologyIds() {
  var selectedOntIds = jQuery("#ontology_ontologyId").val();
  return selectedOntIds === null || selectedOntIds === "" ? ont_ids : selectedOntIds;
}

function currentOntologyAcronyms() {
  var ont_acronyms = new Array();
  var ontologies = currentOntologyIds();
  for(var i=0; i < ontologies.length; i++){
    ont_acronyms.push( ontologies[i].split('/').slice(-1)[0] );
  }
  return ont_acronyms;
}

function chosenSearchClasses() {
  var chosenClassesMap = {};
  // get selected option values, an array of combined_uri strings.
  var combined_uris = jQuery("#resource_index_classes").val();
  if (combined_uris === null){
    return chosenClassesMap;
  } else if (typeof combined_uris === "string"){
    combined_uris = combined_uris.split(); // coerce it to an Array
  }
  for(var i=0; i < combined_uris.length; i++){
    var combined_uri = combined_uris[i];
    var split_uris = uri_split(combined_uri);
    var chosen_ont_uri = split_uris[0];
    var chosen_cls_uri = split_uris[1];
    if(! chosenClassesMap.hasOwnProperty(chosen_ont_uri)) {
      chosenClassesMap[chosen_ont_uri] = new Array();
    }
    chosenClassesMap[chosen_ont_uri].push(chosen_cls_uri);
  }
  return chosenClassesMap;
}

function chosenSearchClassesArgs(chosenClassesMap) {
  if (chosenClassesMap === undefined){
    chosenClassesMap = chosenSearchClasses();
  }
  var chosenClassesURI = "";
  for (var ont_uri in chosenClassesMap) {
    var chosenClassArr = chosenClassesMap[ont_uri];
    chosenClassesURI += "classes[" + encodeURIComponent(ont_uri) + "]=";
    chosenClassesURI += encodeURIComponent(chosenClassArr.join(','));
    chosenClassesURI += "&";
  }
  return chosenClassesURI.slice(0,-1); // remove last '&'
}

