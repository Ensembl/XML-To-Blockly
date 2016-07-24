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
var slotNumber;

var creatingBlock=false;
var indexSpecifier=-1;
var seen=false;
var expectedBlockNumber;
var assignedPrettyName = [];

var unicode_pattern_for_prev_level = "";

var non_last_child  = "\u2503       ";
var     last_child  = "        ";
var non_last_branch = "\u2523\u2501\u2501 ";
var     last_branch = "\u2517\u2501\u2501 ";


var magicType = {
    'optional'  :   {
                        'hasBottomNotch'    :   false,
                        'hasSeparateKids'   :   false,
                        'hasLoopRisk'       :   false,
                        'prettyIndicator'   :   '?'
                    },
    'choice'  :   {
                        'hasBottomNotch'    :   false,
                        'hasSeparateKids'   :   true,
                        'hasLoopRisk'       :   false,
                        'prettyIndicator'   :   '|'
                    },
    'interleave'  :   {
                        'hasBottomNotch'    :   true,
                        'hasSeparateKids'   :   true,
                        'hasLoopRisk'       :   true,
                        'prettyIndicator'   :   '&'
                    },
    'zeroOrMore'  :   {
                        'hasBottomNotch'    :   true,
                        'hasSeparateKids'   :   false,
                        'hasLoopRisk'       :   false,
                        'prettyIndicator'   :   '*'
                    },
    'oneOrMore'  :   {
                        'hasBottomNotch'    :   true,
                        'hasSeparateKids'   :   false,
                        'hasLoopRisk'       :   true,
                        'prettyIndicator'   :   '+'
                    }
};

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
	slotNumber = 0;	//re-initialize each time the user chooses a new file
    expectedBlockNumber = 1;
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
    var blockOrder          = [];   // the block descriptions, ordered by their position in the queue

    blockRequestQueue.push( {
        "blockName"         : "start",
        "children"          : substitutedNodeList(startContent, "{}", "START"),
        "topList"           : [],
        "bottomList"        : []
    } );  // initialize the queue

    while(blockRequestQueue.length>0) {     // keep consuming from the head and pushing to the tail
        var blockRequest = blockRequestQueue.shift();

        var children     = blockRequest.children;
        var blockName    = blockRequest.blockName;
        var topList      = blockRequest.topList;
        var bottomList   = blockRequest.bottomList;

        var blockCode = "";   // Contains data sent by all the children merged together one after the other.

        for(var i=0;i<children.length;i++){
            //var len = children[i].childNodes.length;
            //var last_sibling = (len==1) ? 'true' : undefined;
            blockCode += goDeeper( blockRequestQueue, children[i], "{}", i , '', undefined);
        }

            // We want to always have a start block and here we force its blockCode to be unique
        if( blockName == "start" ) {
            blockCode += " ";
        }

        if( codeDict.hasOwnProperty(blockCode) ) {  // if we have created this block already, just merge the compatibility lists
                Array.prototype.push.apply( codeDict[blockCode].topList, topList);
                Array.prototype.push.apply( codeDict[blockCode].bottomList, bottomList);

        } else {    // otherwise create a new block

            codeDict[blockCode] = {
                "blockName"     : blockName,    // it is only a "suggested display name", we use numbers internally
                "blockCode"     : blockCode,
                "topList"       : topList,
                "bottomList"    : bottomList
            };
            blockOrder.push( codeDict[blockCode] );   // this is a reference to the same object, so that further modifications of topList and bottomList are seen
        }
    }

    var toolboxXML      = "";
    var allCode         = [];
    var blockCounter    = 0;
    var blockCode;

    for (var i=0;i<blockOrder.length;i++){
        var dictEntry   = blockOrder[i];
        var displayName = dictEntry.blockName;
        var blockName   = "block_" + blockCounter;
        var topText     = dictEntry.topList.length      ? "true, ["+dictEntry.topList.join()+"]"    : "false";
        var bottomText  = dictEntry.bottomList.length   ? "true, ["+dictEntry.bottomList.join()+"]" : "false";

        toolboxXML  += "<block type='" + blockName + "'></block>";

        blockCode   = "Blockly.Blocks['" + blockName + "']={ init:function() {"
                    + "this.appendDummyInput().appendField('====[ " + blockName + ": " + displayName + " ]====');\n"
                    + dictEntry.blockCode
                    + "this.setPreviousStatement(" + topText + ");"
                    + "this.setNextStatement(" + bottomText + ");"
                    + "this.setColour(" + hue.generate() + ");"
                    + "}};";

        blockCode = blockCode.replace(/\n{2,}/g, "\n");
        allCode.push(blockCode);
        blockCounter++;
    }
    document.getElementById('toolbox').innerHTML = toolboxXML;
    document.getElementById('results').innerHTML = "<pre>" + allCode.join("</pre><pre>") + "</pre>";

    eval(allCode.join(""));

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

            if( magicType.hasOwnProperty(currChild.nodeName) ) {      // testing if currChild is magic in general
                currChild.setAttribute("context_child_idx", "("+currChild.getAttribute("context")+"_"+i.toString()+")");  // magic tags will need this to create a block
			} else {
                currChild.setAttribute("haveAlreadySeen", haveAlreadySeenStr);                  // non-magic tags will need this to support loop detection
            }

            substChildren.push( currChild );
        }
    }

    return substChildren;   // all you get in the end is a merged list of non-ref children with some of the tags set (grandchildren may contain refs)
}


function goDeeper(blockRequestQueue, node, haveAlreadySeenStr, path, common_prefix, last_sibling) {
    var head_suffix = (last_sibling == undefined)? '': last_sibling? last_branch: non_last_branch;
    var child_suffix = (last_sibling == undefined)? '': last_sibling? last_child: non_last_child;
    var unicode_pattern = common_prefix + head_suffix;

    var nodeType = (node == null) ? "null" : node.nodeName;

	var blocklyCode = ""; // Contains data sent by all the children merged together one after the other.

    if(nodeType == "null") {

        blocklyCode = "this.appendDummyInput().appendField('*** CIRCULAR REFERENCE ***');"; // FIXME: can we escape directly out of the recursion in JS?

    }

	else if(nodeType == "text") {

        var name = path + "TXT";

        var displayName = "";

        if(node.parentNode.childNodes.length == 1 && node.parentNode.getAttribute("name")){
            displayName = node.parentNode.getAttribute("name");
            unicode_pattern = unicode_pattern_for_prev_level;
        } else{
            displayName = "text";
        }

        blocklyCode += "this.appendDummyInput().appendField('" + unicode_pattern + "').appendField('"+displayName+"').appendField(new Blockly.FieldTextInput(''),'" + name + "');";

    }

	else if(nodeType == "element") {
        unicode_pattern_for_prev_level = unicode_pattern;

        var nodeName = node.getAttribute("name");

        var name = path + "ELM_" + nodeName;
        var context = node.getAttribute("context");
        haveAlreadySeenStr = node.getAttribute("haveAlreadySeen");
        var children = substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);

        var singleChild = ['text', 'data', 'value'];
		if(! (children.length == 1 && singleChild.indexOf(children[0].nodeName)!=-1) ) {
            blocklyCode += "this.appendDummyInput().appendField('" + unicode_pattern + "').appendField('"+nodeName+"');";  // a label for the (non-empty) parent
        }

		if(children.length == 1){
			var childData="";
			childData = goDeeper( blockRequestQueue, children[0], haveAlreadySeenStr, name + '_' + 0, common_prefix+child_suffix, true );
			//childData will contain the parent element's name only if it is being returned by a choice containing values. In that case, we need to remove the dummyInput+label that we had set for the element in the above if statement as the child itself sends the label also.
			//So, we replace blocklyCode with childData in this case otherwise we always add data returned by the child to blocklyCode.
			//Assumption: Consider an element which contains a choice, which, in turn, has a list of values as its children. Assumption made is that such an element cannot have any other children along with choice+lost of values.
			if( childData.indexOf("'" + node.getAttribute("name") + "'") != -1 ){
				blocklyCode = childData;
			}else{
				blocklyCode += childData;
			}
		}else{
			for(var i=0;i<children.length;i++){
                var this_is_last_sibling = (i == children.length-1);
                blocklyCode += goDeeper( blockRequestQueue, children[i], haveAlreadySeenStr, name + '_' + i , common_prefix+child_suffix, this_is_last_sibling);
            }
		}

		/*
        for(var i=0;i<children.length;i++){
            childData = goDeeper( blockRequestQueue, children[i], haveAlreadySeenStr, name + '_' + i );

			if(childData.indexOf("'"+name+"'")!=-1){	//if element has choice which has value
				blocklyCode = childData;
			}else{
				blocklyCode += childData;
			}
        }*/
    }


	else if(nodeType == "attribute") {
        unicode_pattern_for_prev_level = unicode_pattern;
        var nodeName = node.getAttribute("name");

        var name = path + "ATT_" + nodeName;
        var context = node.getAttribute("context");
        haveAlreadySeenStr = node.getAttribute("haveAlreadySeen");
        var children = substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);

        if( children.length == 0 ){
			blocklyCode += "this.appendDummyInput().appendField('" + unicode_pattern + "').appendField('" + nodeName + "').appendField(new Blockly.FieldTextInput(''),'" + name + "');";
		} else{
			for(var i=0;i<children.length;i++){
                var this_is_last_sibling = (i == children.length-1);
                blocklyCode += goDeeper( blockRequestQueue, children[i], haveAlreadySeenStr, name + '_' + i , common_prefix+child_suffix, this_is_last_sibling);
			}
		}

        //if there are multiple children of an attribte (like two text tags), its name won't be added by its children and we need to add it here
        if( blocklyCode.indexOf("appendField('"+nodeName) ==-1 ){
            var displayStatement = "this.appendDummyInput().appendField('" + unicode_pattern + "').appendField('"+nodeName+"');";
            blocklyCode = displayStatement + blocklyCode;
        }
    }


	else if(nodeType == "group"){
		var context = node.getAttribute("context");
		var children = substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);
		var name = path + "GRO_";

		blocklyCode = "this.appendDummyInput('"+name+"').appendField('" + getUnicodeChars(indentationLevel-1, linePrefix) + "').appendField('"+name+"');";

		for(var i=0;i<children.length;i++){
			blocklyCode += goDeeper( blockRequestQueue, children[i], haveAlreadySeenStr, name + i , indentationLevel, linePrefix);
		}
	}
	/*
	//we'll reach here only if a node has value as one child and has some other types of children along with it(unlikely situation)
	else if(nodeType == "value"){
		var name = path + "VAL_";
		var content = node.textContent;
		blocklyCode = "this.appendDummyInput('"+name+"').appendField('"+name+"').appendField('\t"+content+"');";
	}
	*/

	//currently data ignores any <param> tags that it may contain
	else if(nodeType == "data"){
        //indentationLevel--; //reduce indentation level as this tag creates the entire field for its parent.
		var type=node.getAttribute("type");
		if(type!=null){
			if(numberTypes.indexOf(type)!=-1){
				type="Blockly.FieldTextInput.numberValidator";
			}else{
				type=null;
			}
		}
		var name = path + "DAT_";

        var displayName = node.parentNode.getAttribute("name") + " (" + node.getAttribute("type") + ")";
		blocklyCode += "this.appendDummyInput().appendField('" + unicode_pattern_for_prev_level + "').appendField('"+displayName+"').appendField(new Blockly.FieldTextInput('',"+type+" ), '"+name+"');";
	}


	else if(nodeType == "choice") {
		var values = allChildrenValueTags(node);	//returns array of all values if all children are value tags, otherwise returns false
		if(values == false){
			blocklyCode = handleMagicBlock(blockRequestQueue, node, haveAlreadySeenStr, path, false, common_prefix, last_sibling);
		} else{
			/*var lastUnderscore = -1;
			for(var i=path.length-1;i>=0;i--){
				if(path.charAt(i) == "_"){
					lastUnderscore = i;
					break;
				}
			}
			var parentName = path.substring(0 , lastUnderscore);*/
            //indentationLevel--; //as this one attaches itself at its parent's level
            var parentName = node.parentNode.getAttribute("name");
			blocklyCode = "this.appendDummyInput().appendField('" + unicode_pattern_for_prev_level + "').appendField('"+parentName+"').appendField(new Blockly.FieldDropdown(["+values+"]),'"+parentName+"');";
		}

    }

	else if(nodeType == "interleave"){
		blocklyCode = handleMagicBlock(blockRequestQueue, node, haveAlreadySeenStr, path, false, common_prefix, last_sibling);
	}

	else if(nodeType == "optional"){
		blocklyCode = handleMagicBlock(blockRequestQueue, node, haveAlreadySeenStr, path, false, common_prefix, last_sibling);
	}

	else if(nodeType == "zeroOrMore"){
		blocklyCode = handleMagicBlock(blockRequestQueue, node, haveAlreadySeenStr, path, false, common_prefix, last_sibling);
	}

	else if(nodeType == "oneOrMore"){
		blocklyCode = handleMagicBlock(blockRequestQueue, node, haveAlreadySeenStr, path, false, common_prefix, last_sibling);
	}

    return blocklyCode + "\n";
}


//creates a notch in its parent block with a label for the magic block that has called it. Then creates a separate block for every child.
function handleMagicBlock(blockRequestQueue, node, haveAlreadySeenStr, path, bottomNotchOverride, common_prefix, last_sibling){
    var nodeType = node.nodeName;
	var context = node.getAttribute("context");
    var context_child_idx = node.getAttribute("context_child_idx");
    var children = substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);
	var name = path + nodeType.substring(0,3).toUpperCase() + ("_");	//the second part gives strings like CHO_, INT_ and so on.

    var head_suffix = (last_sibling == undefined)? '': last_sibling? last_branch: non_last_branch;
    var child_suffix = (last_sibling == undefined)? '': last_sibling? last_child: non_last_child;
    var unicode_pattern = common_prefix + head_suffix;

    //This statement probably needs to be deleted
	var blocklyCode = "this.appendStatementInput('"+slotNumber+"').setCheck(["+slotNumber+"]).appendField('" + unicode_pattern + "').appendField('"+name+"');";

        //each block created here will have a topnotch. It may or may not have a bottom notch depending on nodeType
	var topListStr      = "["+slotNumber+"]";
    var bottomListStr   = (bottomNotchOverride || magicType[nodeType].hasBottomNotch) ? topListStr : "[]";
    if(! node.hasAttribute("visited") ) {
        //Rule 1
        //if any magic node has another magic node as its only child, inline the child
        if(children.length == 1 && magicType.hasOwnProperty(children[0].nodeName)){
            blocklyCode = "this.appendDummyInput().appendField('" + unicode_pattern + "').appendField('"+name+"');";
            var childPath = name + '0';
            setVisitedAndSlotNumber(node);  //set only visited. Not slotNumber (done to prevent infinite loop)
            var child = children[0];

            if(bottomListStr != "[]"){
                //if current tag has bottom notch, propagate its bottom notch to children
                bottomNotchOverride = true;
            }else{
                bottomNotchOverride = false;
            }

            blocklyCode += handleMagicBlock(blockRequestQueue, child, haveAlreadySeenStr, childPath, bottomNotchOverride, common_prefix+child_suffix, false);
        }else{

            if( magicType[nodeType].hasSeparateKids ) {
                var childrenDisplayNames = [];
                for(var i=0;i<children.length;i++){
                    var currentChild = children[i];
                    //var childBlockName  = currentChild.getAttribute("blockly:blockName") || ( path + "_" + node.nodeName.substring(0,3) + "_cse" + i + context_child_idx );
                    var childBlockName = expectedBlockNumber;
                    childBlockName = children[i].getAttribute("name") ? children[i].getAttribute("name") : expectedBlockNumber;
                    childBlockName = children[i].getAttribute("blockly:blockName") ? node.childNodes[i].getAttribute("blockly:blockName") : childBlockName;
                    childrenDisplayNames.push(childBlockName);
                    //alert(expectedBlockNumber + " for " + childBlockName);
                    pushToQueue(blockRequestQueue, childBlockName, [currentChild], JSON.parse(topListStr), JSON.parse(bottomListStr));
                    expectedBlockNumber++;
                }
                childrenDisplayNames = childrenDisplayNames.join(" " + magicType[node.nodeName].prettyIndicator + " ");
                assignedPrettyName[node] = childrenDisplayNames;
                blocklyCode = "this.appendStatementInput('"+slotNumber+"').setCheck(["+slotNumber+"]).appendField('" + unicode_pattern + "').appendField('"+childrenDisplayNames+"');";

			} else{
					//var childBlockName = path + "_" + node.nodeName.substring(0,3) + context_child_idx;
                    var childBlockName = expectedBlockNumber;
                    if(children.length == 1){
                        childBlockName = children[0].getAttribute("name") ? children[0].getAttribute("name") : expectedBlockNumber;
                        childBlockName = children[0].getAttribute("blockly:blockName") ? node.childNodes[0].getAttribute("blockly:blockName") : childBlockName;
                    }
                    //alert(expectedBlockNumber + " for " + childBlockName);
                    pushToQueue(blockRequestQueue, childBlockName, children, JSON.parse(topListStr), JSON.parse(bottomListStr));
                    expectedBlockNumber++;
                    assignedPrettyName[node] = childBlockName;
                    blocklyCode = "this.appendStatementInput('"+slotNumber+"').setCheck(["+slotNumber+"]).appendField('" + unicode_pattern + "').appendField('"+childBlockName + magicType[node.nodeName].prettyIndicator +"');";
            }
            setVisitedAndSlotNumber(node, slotNumber);

        }
    } else if(magicType[nodeType].hasLoopRisk) {
			alert("circular ref loop detected because of "+node.nodeName);
			blocklyCode = "this.appendDummyInput().appendField('***Circular Reference***');";
    } else {
			alert(node.nodeName + " " + context + "_" + node.nodeName.substring(0,3) + context_child_idx + " has been visited already, skipping");
			var assignedSlotNumber = node.getAttribute("slotNumber");
            var prettyName = assignedPrettyName[node];
			blocklyCode = "this.appendStatementInput('"+slotNumber+"').setCheck(["+assignedSlotNumber+"]).appendField('" + unicode_pattern + "').appendField('"+prettyName+"');";
            slotNumber++;
	}
	return blocklyCode;
}

function pushToQueue(blockRequestQueue, blockName, children, topList, bottomList){
    blockRequestQueue.push({
        "blockName"         :blockName,
        "children"          :children,
        "topList"           :topList,
        "bottomList"        :bottomList
    } );
}

function setVisitedAndSlotNumber(node, slot){
    node.setAttribute("visited", "true");
    if(slot != undefined){
        node.setAttribute("slotNumber", slot);
        slotNumber++;
    }
}

function allChildrenValueTags(node){
	var allValues = "";
	var children = node.childNodes;

	for(var i=0;i<children.length;i++){
		if(children[i].nodeName == "value"){
			var value=children[i].textContent;
			if(allValues==""){
				allValues="['"+value+"','"+value+"']";
			}else{
				allValues=allValues+",['"+value+"','"+value+"']";
			}
		}else{
			return false;
		}
	}

	return allValues;
}


function getDisplayName(node){
    var displayName = node.getAttribute("name");
    if(displayName){
        return displayName;
    } else{
        var parentName = node.parentNode.getAttribute("name");
        if(parentName){
            return parentName;
        } else{
            return node.nodeName;
        }
    }
}

function getUnicodeChars(level, linePrefix){
    var str="";

    if(level == 0){
        return str;
    }

    if(level==1){
        str = "\u2517\u2501\u2501";
        return str;
    }
    /* \u2514 is tetris. \u2500 is horizontal line \u2502 is vertical line*/
    for(var i=0 ; i<level; i++){
        if(i==0){
            if(linePrefix){
                str += "\u2503        ";
            } else{
                str += "         ";
            }

        }else if(i==level-1){
            str += "\u2517\u2501\u2501";
        }else{
            str+="        ";
        }
    }
    //str+="\u2514"
    return str;
}

function getDesign(str, level, addLine){
    var nodeName = node.getAttribute("name");

    var head_suffix = (last_sibling == undefined)? '': last_sibling? last_branch: non_last_branch;

    var child_suffix = (last_sibling == undefined)? '': last_sibling? last_child: non_last_child;

    console.log( common_prefix+head_suffix+nodeName );
    var children = node.childNodes;
    if( children.length>0 ) {
        for(var i=0 ; i<children.length ; i++) {
            var this_is_last_sibling = (i == children.length-1);
            print_node( children[i], common_prefix+child_suffix, this_is_last_sibling );
        }
    }
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
