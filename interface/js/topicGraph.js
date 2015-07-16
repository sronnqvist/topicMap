/* topicGraph - (c) 2014-15 Samuel Ronnqvist - sronnqvi@abo.fi */



var width = window.innerWidth-4,
    height = window.innerHeight-4;

function color(h){return Color.hsl(h,0.7,0.4)}

function prob2opacity(p){ return (p)*0.8+0.1; }

function neighboring(a, b) {
    var n = neighbors[a];
    if(a == undefined || b == undefined || n == undefined) return false;
    return n.indexOf(b) > -1;
}

function node_focus(cnode){
    gnodes
        .attr("fill",function(o){
            if(neighboring(cnode.index, o.index)){
                if(o.group == 1 && o.index != cnode.index){
                    var size = node_weights[[o.name, cnode.name]]*16+7;
                    return("#000");//#fff");
                } //else return("9pt")
            } //else return "9pt";
        });

    // Change node opacities
    gnodes.transition().delay(50).attr("opacity", function(o) {
        if(neighboring(cnode.index, o.index)) return "0.9"
        else {return "0.2"};
    }).duration(200);
    /*
    gnodes.selectAll("text").transition().delay(50).attr("font-weight", function(o) {
        if(neighboring(cnode.index, o.index)) return "bold";
        else {return "normal"};
    }).duration(200);*/

    d3.select(this).attr("stroke-opacity","1");

    // Change link opacities
    var retval;
    link.transition().delay(50).attr('opacity', function(l) {
        if(cnode == l.source){
            retval = 0.8;
        } else if(cnode == l.target){
            retval = 0.8;
        } else {
            retval = 0.2;
        }
        return retval;
        })
        /*.attr('stroke', function(l) {
            if(cnode == l.source){
                retval = "#acf";
            } else if(cnode == l.target){
                retval = "#acf";
            } else {
                retval = "#666";
            }
            return retval;
        })*/
        .duration(200);
}

function link_focus(clink){
    link.attr('opacity', function(l) {
        if(clink.source.index != l.source.index && clink.target.index != l.target.index){
            return 0.15;
        } else return prob2opacity(l.value);
    });
}

function unfocus(){
    if(mouseDown) return;
    gn = d3.selectAll(".gnode");
    gn.transition()
        .attr("opacity","1.0")
        .duration(200);
    /*gn.selectAll("text")
        .attr("font-weight","normal");*/

    gn.style('font-size','9pt');

    link.transition()
        .attr('opacity', function(l) {
            return prob2opacity(l.value);
        })
        .duration(200);
}

function node_select(cnode){
    // Manage selection list
    if(cnode.name in selected){
        // Deselect node
        delete selected[cnode.name];
    } else {
        // Select node
        selected[cnode.name] = true;
    }

    // Set appearance for selected nodes
    for(n in selected){
        nd = d3.select("#node_"+n)
        if(n[0] == 'T'){
            // Topic nodes
            nd.attr("fill",function(d){ return Color.hsl(d.topic/ntopics, 0.7, 0.2) });
        } else {
            // Keyword nodes
            nd.select("text")
                .style("text-decoration","underline")
                .style("font-weight","bold")
                //.style("font-color","#eee");
                .style("font-color","#111");
        }
    }

    // Set appearance for deselected nodes
    var not_selected = {};
    _.filter(_.map(nodes, function(x){ return x.name }), function(x){ return !(x in selected) }).forEach(
        function(n){ not_selected[n] = true }
    );
    for(n in not_selected){
        nd = d3.select("#node_"+n);
        if(n[0] == 'T'){
            // Topic nodes
            nd.attr("fill", "black");
        } else {
            // Keyword nodes
            nd.select("text")
                .style("text-decoration","inherit")
                .style("font-weight","inherit")
                .style("font-color","inherit");
        }
    }

    update_panel();

}

function update_panel(){
    var sel = d3.select(".info");
    sel.style("display","block");
    sel.selectAll("p").data([]).exit().remove();

    if(_.keys(selected).length == 0){ sel.style("display","none"); return }
    sel.append("p").text(_.reduce(_.keys(selected), function(a,b){return a+', '+b}));

    sel.append("p").html("<b>Documents</b>");
    var out = "<ul>";
    _.sortBy(topic2docs[0], function(x){return(x[1]*-1)}).slice(0,10).forEach(function(d){
        titl = titles[d[0]];
        if(titl.length > 32){
            titl = titl.slice(0,32);
            titl += "...";
        }
        out += "<li>"+titl+' '+d[1]+"</li>";
    });
    sel.append("p").html(out+"</ul>");
}

function link_select(link){
    // Not implemented / needed
}

function linkStrengthFunc(d){
    return d.value*0.7+0.3;
}

var force = d3.layout.force()
    .charge(-200)
    /*.linkDistance(function(d,i) {
        termDegree = _.filter(links, function(x){return(x.source.index == i || x.target.index == i)}).length;
        return ((180-d.value*100)*Math.pow(termDegree), 1.2);
    })*/
    .linkDistance(150)
    .size([width, height])
    .gravity(0.025)
    .friction(0.9)
    .linkStrength(function(d){
        return Math.pow(d.value,2)*1.2;
    });

var mouseDown = 0;
document.body.onmousedown = function() {
    mouseDown = 1;
}

document.body.onmouseup = function() {
    mouseDown = 0;
}

var nodes, links, node, link, gnodes, neighbors = {}, node_weights = {}, selected = {}, ntopics, node_names;

var zoomer = d3.behavior.zoom().scaleExtent([-8, 8]).on("zoom", zoom);

var svg = d3.select("body")
    .append("svg")
    .attr("id", "svgRoot")
    .attr("width", width)
    .attr("height", height)
    .attr("xmlns", "http://www.w3.org/2000/svg")
    .attr("version", 1.1)
    .append("g")
    .call(zoomer)
    .append("g")
    .attr("id", "allContent");

svg.append("rect")
    .attr("class", "overlay")
    .attr("width", width*10)
    .attr("height", height*10)
    .attr("x",-5*width)
    .attr("y",-5*height)
    .attr("stroke","#aaa")
    .attr("fill", "none");

function zoom() {
    svg.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}

zoomer.scale(0.2);
zoomer.translate([width*0.4,height*0.4]);
zoomer.event(svg);

function zoomBy(factor){
    zoomer.scale(zoomer.scale()*factor);
    //zoomer.translate([width*0.45,height*0.45]);
    zoomer.event(svg);
}

nodes = [];
links = [];

var graph = d3.json("data/graph.json", function(error, graph) {
    nodes = graph.nodes;
    links = graph.links;

    force
        .nodes(graph.nodes)
        .links(graph.links)
        .start();

    ntopics = _.filter(nodes, function(x){return x.group == 0}).length;

    link = svg.selectAll(".link")
        .data(graph.links)
        .enter().append("line")
        .attr("class", "link")
        .attr("stroke-width", function(d) { return 2.2; })
        .attr("stroke", function(d,i) {
            return "#024";
/*            //if(d.value > 0.7) return "#24e";
            if(nodes[d.source.index].group == 0) return "#aaa";//"#666";//color(nodes[d.source.index].topic/ntopics)
            else if(nodes[d.target.index].group == 0) return "#aaa";//"#666";//color(nodes[d.target.index].topic/ntopics)
            else return "#000";//"#fff";*/
        })
        .attr("opacity", function(d) { return prob2opacity(d.value) });

    var drag = force.drag()
        .on("dragstart", dragstarted)
        .on("drag", dragged)
        .on("dragend", dragended);

    function dragstarted(d) {
        d3.event.sourceEvent.stopPropagation();
        //d.fixed = true;
        d3.select(this).classed("dragging", true);
    }

    function dragged(d) {
        d3.select(this).attr("cx", d.x = d3.event.x).attr("cy", d.y = d3.event.y);
    }
    function dragended(d) {
        d3.select(this).classed("dragging", false);
    }

    gnodes = svg.selectAll(".gnode")
        .data(graph.nodes)
        .enter()
        .append("g")
        .classed("gnode", true)
        .attr("id", function(d){ return ("node_"+d.name) })
        .on("mouseenter", node_focus)
        .on("mouseleave", unfocus)
        .on("dblclick", node_select)
        .call(force.drag);

    gnodes.append("circle")
        .attr("class", "node")
        .attr("r", function(d){
            if(d.group == 0) return Math.pow(d.prop,0.9)*200; //d.prop*200 //50*Math.sqrt(d.prop/3.1415926)
            else return 5;
        })
        .attr("opacity", function(d){
            if(d.group == 0) return 0.9;
            else return 0.3;
        })
        .attr("stroke", function(d,i) {
            if(d.group == 0)
                return color(d.topic/ntopics);
            else return "white";
        })
        .attr("stroke-width", "2px");

    gnodes.append("text")
        .attr("text-anchor", "middle")
        .attr("dy",".35em")
        .text(function(d) { return d.name; })
        .attr("fill", function(d){
            if(d.group==0)
                return("#000");//"#e0e0e0");//return(color(d.topic/ntopics));
            else
                return("#888");
        })
        .style("font-weight", function(d){
            if(false && d.group==0)
                return("bold");
            else return("normal");
        })
        .style("font-size", function(d){
            if(d.group==0){
                console.log(d.prop);
                //return((8+Math.log(1+d.prop,2)*6000)+"pt");
                return((Math.log(d.prop)+10)*10+"pt");
            } else {
                return("10pt");
            }
        })
        .on("mouseenter", function(){
            d3.select(this).attr("fill", "#003")//#fff")
        })
        .on("mouseleave", function(){
            d3.select(this).attr("fill", "#000")//#e0e0e0")
        });

    force.on("tick", function() {
        link.attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });

        gnodes.attr("cx", function(d) { return d.x; })
            .attr("cy", function(d) { return d.y; });

        gnodes.attr("transform", function(d) {
            return 'translate(' + [d.x, d.y] + ')';
        });
    });

    links.forEach(function(l){
        if(neighbors[l.source.index] == undefined)
            neighbors[l.source.index] = [l.source.index, l.target.index];
        else neighbors[l.source.index].push(l.target.index);
        if(neighbors[l.target.index] == undefined)
            neighbors[l.target.index] = [l.target.index, l.source.index];
        else neighbors[l.target.index].push(l.source.index);

        if(l.source.group == 0){
            var termnode = l.target;
            var topicnode = l.source;
        } else {
            var termnode = l.source;
            var topicnode = l.target;
        }
        node_weights[[termnode.name, topicnode.name]] = l.value;
    });

    node_names = _.map(nodes, function(x){ return x.name })

});


setTimeout(function(){
    var header = d3.selectAll(".header");
    header.transition().duration(2000).style("opacity", 0);
    header.transition().style("display", "none").delay(2000);
}, 6000);

setTimeout(function(){
    force.charge(-800).start();
}, 200);
setTimeout(function(){
    force.charge(-1200).linkStrength(linkStrengthFunc).start();
}, 600);

