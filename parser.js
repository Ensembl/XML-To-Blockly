/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var blocklyWorkspace;
var blocks;
var blockNames;
var oneOrMoreBlocks;
var optionalNames;
var rngDoc;

var creatingBlock=false;
var indexSpecifier=-1;
var seen=false;

var magicBlocks=[ 'oneOrMore' , 'optional' , 'zeroOrMore' , 'choice' , 'interleave' ];
var numberTypes=[ 'int' , 'integer' , 'double' , 'float' , 'decimal' , 'number' ];

//init function for initializing the Blockly block area
function init(){
	blocklyWorkspace = Blockly.inject('blocklyDiv', {
        toolbox: document.getElementById('toolbox'),
        collapse: true
	});
}

// loads the file into RNG textarea and leaves it there for potential manual edit
function readFile(event) {
    var filename=event.target.files[0];
    var reader=new FileReader();
    reader.readAsText(filename);
    reader.onload=function(e){
        document.getElementById('rng_area').value = e.target.result;
    }
}

//handles xml by creating blocks as per RNG rules
function handleRNG( unparsedRNG ){

    blocks=[];
    blockNames=[];
    oneOrMoreBlocks=[];
    optionalNames=[];

    var xmlParser=new DOMParser();
    rngDoc=xmlParser.parseFromString(unparsedRNG, "text/xml");

	removeRedundantText(rngDoc.documentElement);
	removeXMLComments(rngDoc.documentElement);

    hue.reset();    // start each batch of hues from 0

    var rootElement = rngDoc.documentElement;
    var startContent = (rootElement.nodeName == "grammar")
        ? rngDoc.getElementsByTagName("start")[0].childNodes
        : [ rootElement ];

    var codeDict            = {};   // maps block names to the code (to be reviewed)
    var blockRequestQueue   = [];   // a queue that holds requests to create new blocks

    blockRequestQueue.push( {
        "blockName"         : "start",
        "children"          : substitutedNodeList(startContent, "{}", "START"),
        "top"               : false,
        "bottom"            : false
    } );  // initialize the queue

    while(blockRequestQueue.length>0) {     // keep consuming from the head and pushing to the tail
        var blockRequest = blockRequestQueue.shift();

        var blockName    = blockRequest.blockName;
        var children     = blockRequest.children;
        var top          = blockRequest.top;
        var bottom       = blockRequest.bottom;

        var blockCode = "";   // Contains data sent by all the children merged together one after the other.

        for(var i=0;i<children.length;i++){
            blockCode += goDeeper(codeDict, blockRequestQueue, children[i], "{}", i );
        }
		
		//If there is already a block like the current one and that block's name is start, then we create a separate block for current one in order to compulsorily have a start block.
		if( (! (codeDict[blockCode] ==undefined && codeDict[blockCode]==null)) && codeDict[blockCode].blockName == "start" ){
			blockCode+="this.appendDummyInput();";
		}
		
        codeDict[blockCode] = {
            "blockName" : blockName,
            "blockCode" : blockCode,
            "top"       : top,
            "bottom"    : bottom
        };
    }

    var toolboxXML  = "";
    var allCode     = "";
    for (var key in codeDict) {
        var dictEntry   = codeDict[key];
        var blockName   = dictEntry.blockName;

        toolboxXML  += "<block type='" + blockName + "'></block>";

        allCode    += "\nBlockly.Blocks['" + blockName+"']={ init:function() {"
                    + "this.appendDummyInput().appendField('====[ " + blockName + " ]====');\n"
                    + dictEntry.blockCode
                    + "this.setPreviousStatement(" + dictEntry.top + ");"
                    + "this.setNextStatement(" + dictEntry.bottom + ");"
                    + "this.setColour(" + hue.generate() + ");"
                    + "}};\n";
    }
    document.getElementById('toolbox').innerHTML = toolboxXML;
    document.getElementById('results').innerHTML = "<pre>" + allCode + "</pre>";

    eval(allCode);

    blocklyWorkspace.clear();
    blocklyWorkspace.updateToolbox( document.getElementById('toolbox') );
}


var hue = new function() {      // maintain a closure around nextHue
    var hueStep = 211;
    var nextHue = 0;

    this.reset    = function() { nextHue = 0; }
    this.generate = function() { var currHue=nextHue; nextHue = (currHue+hueStep)%360; return currHue; }
}


function substitutedNodeList(children, haveAlreadySeenStr, substContext) {
    var substChildren = [];
    for(var i=0;i<children.length;i++) {
        var currChild           = children[i];
        var currChildHasSeen    = JSON.parse(haveAlreadySeenStr);

        if(currChild.nodeName == "ref") {
            var nodeName = currChild.getAttribute("name");

            if(currChildHasSeen.hasOwnProperty(nodeName)) {
                alert("A definition loop detected in the RNG ("+nodeName+"), therefore the corresponding system of Blocks is not constructable");
                return [null];     // need to find a way to return nicely

            } else {
                currChildHasSeen[nodeName] = true;
                var defKids = findOneNodeByTagAndName(rngDoc, "define", nodeName).childNodes;

                var substKids = substitutedNodeList(defKids, JSON.stringify(currChildHasSeen), nodeName);
                Array.prototype.push.apply( substChildren, substKids);
            }
        } else {
            currChild.setAttribute("context", substContext);                                // magic tags will use this to propagate the context

            if( magicBlocks.indexOf(currChild.nodeName)!=-1 ) {    // FIXME: change this for a generic test for all magic tags
                currChild.setAttribute("context_child_idx", "("+currChild.getAttribute("context")+"_"+i.toString()+")");  // magic tags will need this to create a block
			} else {
                currChild.setAttribute("haveAlreadySeen", haveAlreadySeenStr);                  // non-magic tags will need this to support loop detection
            }

            substChildren.push( currChild );
        }
    }

    return substChildren;   // all you get in the end is a merged list of non-ref children with some of the tags set (grandchildren may contain refs)
}


function goDeeper(codeDict, blockRequestQueue, node, haveAlreadySeenStr, path) {
	//console.log(node.getAttribute("context_child_idx"));
    var nodeType = (node == null) ? "null" : node.nodeName;

	var blocklyCode = ""; // Contains data sent by all the children merged together one after the other.

    if(nodeType == "null") {

        blocklyCode = "this.appendDummyInput().appendField('*** CIRCULAR REFERENCE ***');"; // FIXME: can we escape directly out of the recursion in JS?

    } 
	
	else if(nodeType == "text") {

        var name = path + "TXT";

        blocklyCode += "this.appendDummyInput().appendField('"+name+"').appendField(new Blockly.FieldTextInput(''),'" + name + "');";

    } 
	
	else if(nodeType == "element") {
        var nodeName = node.getAttribute("name");

        var name = path + "ELM_" + nodeName;
        var context = node.getAttribute("context");
        haveAlreadySeenStr = node.getAttribute("haveAlreadySeen");
        var children = substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);

        if(! (children.length==1 && children[0]!= null && children[0].nodeName=="text") ) {
            blocklyCode += "this.appendDummyInput().appendField('"+name+"');";  // a label for the (non-empty) parent
        }

        for(var i=0;i<children.length;i++){
            blocklyCode += goDeeper( codeDict, blockRequestQueue, children[i], haveAlreadySeenStr, name + '_' + i );
        }
    }

	
	else if(nodeType == "attribute") {
        var nodeName = node.getAttribute("name");

        var name = path + "ATT_" + nodeName;
        var context = node.getAttribute("context");
        haveAlreadySeenStr = node.getAttribute("haveAlreadySeen");
        var children = substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);

        if( children.length == 0 ){
			blocklyCode += "this.appendDummyInput().appendField('" + name + "').appendField(new Blockly.FieldTextInput(''),'" + name + "');";
		} else{
			for(var i=0;i<children.length;i++){
				blocklyCode += goDeeper( codeDict, blockRequestQueue, children[i], haveAlreadySeenStr, name + '_' + i );
			}
		}
    }
	
	
	else if(nodeType == "group"){
		var context = node.getAttribute("context");
		var children = substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);
		var name = path + "GRO_";	

		blocklyCode = "this.appendDummyInput('"+name+"').appendField('"+name+"');";
		
		for(var i=0;i<children.length;i++){
			blocklyCode += goDeeper( codeDict, blockRequestQueue, children[i], haveAlreadySeenStr, name + '_' + i );
		}
	}
	
	//currently data ignores any <param> tags that it may contain
	else if(nodeType == "data"){
		var type=node.getAttribute("type");
		if(type!=null){
			if(numberTypes.indexOf(type)!=-1){
				type="Blockly.FieldTextInput.numberValidator";
			}else{
				type=null;
			}
		}
		var name = path + "DAT_";
		
		blocklyCode += "this.appendDummyInput().appendField('"+name+"').appendField(new Blockly.FieldTextInput('',"+type+" ), '"+name+"');";
	}
	
	
	else if(nodeType == "choice") {
        blocklyCode = createOneBlockPerChild(blockRequestQueue, node, haveAlreadySeenStr, path);
    } 
	
	else if(nodeType == "interleave"){
		blocklyCode = createOneBlockPerChild(blockRequestQueue, node, haveAlreadySeenStr, path);
	} 
	
	else if(nodeType == "optional"){
		blocklyCode = createConsolidatedBlockForChildren(blockRequestQueue, node, haveAlreadySeenStr, path);
	} 
	
	else if(nodeType == "zeroOrMore"){
		blocklyCode = createConsolidatedBlockForChildren(blockRequestQueue, node, haveAlreadySeenStr, path);
	}

	else if(nodeType == "oneOrMore"){
		blocklyCode = createConsolidatedBlockForChildren(blockRequestQueue, node, haveAlreadySeenStr, path);
	}	

    return blocklyCode + "\n";
}


//creates a notch in its parent block with a label for the magic block that has called it. Then creates a separate block for every child.
function createOneBlockPerChild(blockRequestQueue, node, haveAlreadySeenStr, path){
	var context = node.getAttribute("context");
    var context_child_idx = node.getAttribute("context_child_idx");
    var children = substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);
	var name = path + node.nodeName.substring(0,3).toUpperCase() + ("_");	//the second part gives strings like CHO_, INT_ and so on.

	var blocklyCode = "this.appendStatementInput('"+name+"').appendField('"+name+"');";
	
	var bottomNotch="";			//denotes whether the children need to have notches at the bottom.
	if(node.nodeName == "choice"){
		bottomNotch = false;
	} else{
		bottomNotch = true;
	}

    if(! node.hasAttribute("visited") ) {
        for(var i=0;i<children.length;i++){
            var choiceChildNode = children[i];
            var childBlockName  = choiceChildNode.getAttribute("blockly:blockName") || ( path + "_" + node.nodeName.substring(0,3) + "_cse" + i + context_child_idx );
            blockRequestQueue.push( {
                "blockName"         : childBlockName,
                "children"          : [ choiceChildNode ],
                "top"               : true,
                "bottom"            : bottomNotch
            } );
        }

        node.setAttribute("visited", "true");
    } else if(node.nodeName == "interleave") {
		alert("circular ref loop detected because of "+node.nodeName);
		blocklyCode = "this.appendDummyInput().appendField('***Circular Reference***');";
    } else{
		alert(node.nodeName + " " + context + "_" + node.nodeName.substring(0,3) + context_child_idx + " has been visited already, skipping");
	}
	
	return blocklyCode;
}


//creates a notch in its parent block with a label for the magic block that has called it. Then creates a SINGLE block for all its children.
function createConsolidatedBlockForChildren(blockRequestQueue, node, haveAlreadySeenStr, path){
	var context = node.getAttribute("context");
	var context_child_idx = node.getAttribute("context_child_idx");
	var children = substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);
	var name = path + node.nodeName.substring(0,3).toUpperCase() + ("_");

	var blocklyCode = "this.appendStatementInput('"+name+"').appendField('"+name+"');";
	
	var childBlockName = path + "_" + node.nodeName.substring(0,3) + context_child_idx;

	var bottomNotch = "";
	if(node.nodeName == "optional"){
		bottomNotch = false;
	} else{
		bottomNotch = true;
	}
	
	if(! node.hasAttribute("visited") ){
		blockRequestQueue.push( {
			"blockName"					:childBlockName,
			"children"					:children,
			"top"						:true,
			"bottom"					:bottomNotch
		} );

		node.setAttribute("visited", "true");
	} else if(node.nodeName == "oneOrMore") {
		alert("circular ref loop detected because of oneOrMore");
		blocklyCode = "this.appendDummyInput().appendField('***Circular Reference***');";
	} else {
		alert(node.nodeName + " " + context + "_" + node.nodeName.substring(0,3) + context_child_idx + " has been visited already, skipping");
	}
	
	return blocklyCode;
}



//Removes #text nodes
//These are string elements present in the XML document between tags. The
//RNG specification only allows these strings to be composed of whitespace.
//They don't carry any information and can be removed
function removeRedundantText(node) {
	_removeNodeNameRecursively(node, "#text");
}

// Remove #comment nodes because they we want to exclude them from children.length
function removeXMLComments(node) {
	_removeNodeNameRecursively(node, "#comment");
}

// Generic method to remove all the nodes with a given name
function _removeNodeNameRecursively(node, name) {
	var children=node.childNodes;
	for(var i=0;i<children.length;i++){
		if( (name == "#comment" && children[i].nodeName == name) || (children[i].nodeName == name && children[i].nodeValue.trim()=="") ){
			children[i].parentNode.removeChild(children[i]);
			i--;
			continue;
		}else{
			_removeNodeNameRecursively(children[i], name);
		}	
	}
}

//The name for every child block is sent to it by its parent. The child does not need to find its place in the hierarchy. The parent node does it for all of its children and sends them their name while calling them.
function createBlocks(node, name, colour, listOfRefs){
	var children=node.childNodes;
	var blockData="";	//Contains data sent by all the children merged together one after the other.
	var childData=[];	//Keeps track of block data sent by children.
	var childNames=[];	//Keeps track of children block names

	var isVisited=node.getAttribute("visited");
	if(isVisited!=null || isVisited!=undefined){
		var data="this.appendStatementInput().appendField('"+name+"');";
		return data;
		}
	if(magicBlocks.indexOf(node.nodeName)!=-1){
		node.setAttribute("visited","true");
	}


	for(var i=0;i<children.length;i++){
		if(children[i].nodeName=="data"){
			continue;
		}

		var nameAttr=children[i].getAttribute("name");

		if(nameAttr==null){
			nameAttr=children[i].nodeName;
		}

		nameAttr=nameAttr.substring(0,3);

		//The name for the child is given as <parent name/hierarchy>+<first 3 characters of the child element>+<index of the child as per its parent block>.
		var nameForChild=name+":"+nameAttr+i;

		var dataReceivedFromChild=createBlocks(children[i], nameForChild, colour+45, listOfRefs);
		blockData+=dataReceivedFromChild;
		childData.push(dataReceivedFromChild);
		childNames.push("block_"+nameForChild);
	}

	var nodeType=node.nodeName;


	if(nodeType=="element"){
		if(children.length==1 && children[0].nodeName=="text"){
			var data="this.appendDummyInput().appendField('"+name+"').appendField(new Blockly.FieldTextInput(''),'"+name+"');";
			blockData=data+blockData;
		}else{
			var data="this.appendDummyInput().appendField('"+name+"');";
			blockData=data+blockData;
		}
	}


	//attributes do not check the level below them as there is no functionality currently to handle datatypes and parameters. At the attribute node, a dummy input which has a label and an input field is generated.
	else if(nodeType=="attribute"){
		var data="this.appendDummyInput().appendField('"+name+"').appendField(new Blockly.FieldTextInput(''),'"+name+"');";
		return data;
	}


	else if(nodeType=="start"){
		var blockName="block_"+name;
		var finalBlock="Blockly.Blocks['"+blockName+"']={init:function(){this.appendDummyInput().appendField('"+name+"');"+blockData+"this.setColour("+colour+");}};";
		blocks.push(finalBlock);
		blockNames.push(blockName);
		return;
	}



	else if(nodeType=="interleave"){
		var childNamesInFormat="'"+childNames.join("','")+"'";

		for(var i=0;i<childData.length;i++){
			var blockName=childNames[i];
			var finalBlock="Blockly.Blocks['"+blockName+"']={init:function(){"+childData[i]+"this.setPreviousStatement(true,["+childNamesInFormat+"]);this.setNextStatement(true,["+childNamesInFormat+"]);this.setColour("+colour+");}};";
			blocks.push(finalBlock);
			blockNames.push(blockName);
		}

		blockData="this.appendStatementInput('"+name+"').setCheck(["+childNamesInFormat+"]).appendField('"+name+"');";
	}


	else if(nodeType=="choice"){
		var childNamesInFormat="'"+childNames.join("','")+"'";
		for(var i=0;i<childData.length;i++){
			var blockName=childNames[i];
			var finalBlock="Blockly.Blocks['"+blockName+"']={init:function(){"+childData[i]+"this.setPreviousStatement(true,['"+name+"','"+blockName+"']);this.setColour("+colour+");}};";
			blocks.push(finalBlock);
			blockNames.push(blockName);
		}

		//This appends to the block which contains the choice tag and creates a notch there.
		blockData="this.appendStatementInput('"+name+"').setCheck(["+childNamesInFormat+",'"+name+"']).appendField('"+name+"');";
	}


	//get data from all children. Create a block for them. Send appendStatementInput to parent.
	else if(nodeType=="oneOrMore" || nodeType=="zeroOrMore"){
		//instead of keeping just block_+name as the block name, :child has been added to the name to handle cases where the parent oneOrMore node is also supposed to be in the form of a block. eg. <choice><oneOrMore></oneOrMore>.....</choice>
		var blockName="block_"+name+":child";
		var finalBlock="Blockly.Blocks['"+blockName+"']={init:function(){"+blockData+"this.setPreviousStatement(true,['"+blockName+"','"+name+"']);this.setNextStatement(true,['"+blockName+"']);this.setColour("+colour+");}};";

		var data;
		if(nodeType=="oneOrMore"){
			data="this.appendStatementInput('"+name+"').setCheck(['"+blockName+"']).appendField('"+name+"');oneOrMoreBlocks.push(this.id);";
		}else{
			data="this.appendStatementInput('"+name+"').setCheck(['"+blockName+"']).appendField('"+name+"');";
		}
		blocks.push(finalBlock);
		blockNames.push(blockName);
		return data;
	}


	else if(nodeType=="optional"){
		/*
		var childFields=[];
		for(var i=0;i<childNames.length;i++){
			var fieldName=childNames[i].split("block_");
			fieldName=fieldName[1];
			childFields.push(fieldName.toString());
		}
		optionalNames=[];
		//optionalNames="'"+childFields.join("','")+"'";
		optionalNames=childFields;
		var	data="this.appendDummyInput('"+name+"').appendField(new Blockly.FieldCheckbox(\"FALSE\", checker), '"+name+"_checkbox').appendField('"+name+"');";
		blockData=data+blockData;
		*/
		var childNamesInFormat="'"+childNames.join("','")+"'";
		for(var i=0;i<childData.length;i++){
			var blockName=childNames[i];

			var finalBlock="Blockly.Blocks['"+blockName+"']={init:function(){"+childData[i]+"this.setPreviousStatement(true,['"+name+"','"+blockName+"']);this.setColour("+colour+");}};";
			blocks.push(finalBlock);
			blockNames.push(blockName);
		}

		blockData="this.appendStatementInput('"+name+"').setCheck(["+childNamesInFormat+",'"+name+"']).appendField('"+name+"');";
	}


	else if(nodeType=="define"){
			var data="this.appendDummyInput().appendField('"+name+"');";
			blockData=data+blockData;
	}


	else if(nodeType=="ref"){
		var correspondingDefineName=node.getAttribute("name");
		var corrDef = findOneNodeByTagAndName(rngDoc, "define", correspondingDefineName);
		blockData=createBlocks(corrDef, name, colour, listOfRefs);
	}

	else if(nodeType=="text"){
		var parent=node.parentNode;
		var children=parent.childNodes;
		if(parent.nodeName=="element" || parent.nodeName=="attribute"){
			if(children.length>1){
				var data="this.appendDummyInput().appendField('"+name+"').appendField(new Blockly.FieldTextInput(''),'"+name+"');";
				return data;
			}
		}else{
			var data="this.appendDummyInput().appendField('"+name+"').appendField(new Blockly.FieldTextInput(''),'"+name+"');";
			return data;
		}
	}

	//returns block data to the parent node that had called it
	return blockData;
}


//function to check if all the oneOrMore blocks have children attached to them.
function validate(){
	var workspace=Blockly.getMainWorkspace();
	var allClear=true;
	for(var i=0;i<oneOrMoreBlocks.length;i++){
		var currentBlock=Blockly.Block.getById(oneOrMoreBlocks[i],workspace);
		var foundChild=false;
		var connections=[];
		var children=[];
		var childBlockNames=[];	//contains all the allowed child block names

		if(currentBlock==null){
			continue;
		}else{
			//get all children of the current oneOrMore block being tested
			children=currentBlock.getChildren();
			//get all connection types of the current block
			connections=currentBlock.getConnections_();

			//last index of the array indicates the types of allowed connections for children blocks.
			var childConn=connections[connections.length-1];
			console.log(childConn);
			//childConn contains a field check_ which is an array of the valid block types that can be the children of current block. We add these names to childBlockNames
			var typesOfChildren=childConn.check_;
			console.log(typesOfChildren);
			for (var j=0;j<typesOfChildren.length;j++){
				childBlockNames.push(typesOfChildren[j]);
			}

			//parse through all the children of the current block being tested to check if it actually has a nested child element and not just a nextStatement. foundChild keeps track of whether currentBlock has at least one nested child attached to it.
			for(var j=0;j<children.length;j++){
				var currentChildBeingEvaluated=children[j].type;
				if(childBlockNames.indexOf(currentChildBeingEvaluated)!=-1){
					foundChild=true;
				}
			}
			if(foundChild==false){
				alert(currentBlock.type+" needs to have at least one child");
				allClear=false;
			}
		}
	}
	if(allClear==true){
		alert("You may save this!");
	}
}

function checker(){
	var source=this.sourceBlock_;
	//get the name of the checkbox's dummyInput
	var checkBoxFieldName=this.name.split("_checkbox")[0];

	var it;
	var iplist=source.inputList;
	//find out at which position of the inputList of source block, the checkbox is present.
	for(var it=0;it<iplist.length;it++){
		if(iplist[it].name==checkBoxFieldName){
			break;
		}
	}

	if(this.state_==false){
		for(var i=it+1;i<=(it+optionalNames.length);i++){
			iplist[i].setVisible(true);
		}
		source.render();
		return;
	}else if(this.state_==true){
		for(var i=it+1;i<=(it+optionalNames.length);i++){
			iplist[i].setVisible(false);
		}
		source.render();
		return;
	}
}


function findNodesByTagAndName(doc, tag, name) {
    var nodes = doc.getElementsByTagName(tag);
    var matching_nodes = [];
    for (var i=0; i<nodes.length; i++){
        if (nodes[i].getAttribute("name") == name){
            matching_nodes.push( nodes[i] );
        }
    }
    return matching_nodes;
}

function findOneNodeByTagAndName(doc, tag, name) {
    var matching_nodes = findNodesByTagAndName(doc, tag, name);
    if (matching_nodes.length >= 1) {
        return matching_nodes[0];
    } else {
        alert("There are no '" + tag + "' nodes with the name '" + name + "'");
    }
}
