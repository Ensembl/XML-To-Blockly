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

var successfulOptiField;   //true or false depending on whether optiField can be created or not
var currentlyCreatingOptiField;
var notchProperties = {};
var unicode_pattern_for_prev_level = "";

var queueIndex_2_blockType;
var blockTypeToDisplayNameMapper;

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

var defaultProperties = {
    'optional'  :   {
                        'canBeEmpty'        :   true,
                        'shouldHaveOneBlock':   true
                    },
    'choice'    :   {
                        'canBeEmpty'        :   false,
                        'shouldHaveOneBlock':   true
                    },
    'interleave':   {
                        'canBeEmpty'        :   false,
                        'isGrouped'         :   true
                    },
    'zeroOrMore':   {
                        'canBeEmpty'        :   true,
                        'isRepeatable'      :   true
                    },
    'oneOrMore' :   {
                        'canBeEmpty'        :   false,
                        'isRepeatable'      :   true
                    }
};


var numberTypes=[ 'int' , 'integer' , 'double' , 'float' , 'decimal' , 'number' ];

    // a helper to find an element in a list
Object.prototype.isOneOf = function(list) {
    for(i=0;i<list.length;i++) {
        if(this == list[i]) {
            return true;
        }
    }
    return false;
};

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
    queueIndex_2_blockType = {};
    blockTypeToDisplayNameMapper = {};

    var xmlParser=new DOMParser();
    var rngDoc=xmlParser.parseFromString(unparsedRNG, "text/xml");

    var rng2Blockly = new RNG2Blockly(rngDoc);

    document.getElementById('toolbox').innerHTML = rng2Blockly.toolboxXML;
    document.getElementById('results').innerHTML = "<pre>" + rng2Blockly.allCode.join("</pre><pre>") + "</pre>";

    eval(rng2Blockly.allCode.join(""));

    blocklyWorkspace.clear();
    blocklyWorkspace.updateToolbox( document.getElementById('toolbox') );
}

function RNG2Blockly(rngDoc) {
    this.rngDoc = rngDoc;

    var rootElement = rngDoc.documentElement;
    var startContent = (rootElement.nodeName == "grammar")
        ? rngDoc.getElementsByTagName("start")[0].childNodes
        : [ rootElement ];

    removeRedundantText(rootElement);
    removeXMLComments(rootElement);

    var codeDict            = {};   // maps block names to the code (to be reviewed)
    this.blockRequestQueue  = [];   // a queue that holds requests to create new blocks
    var blockOrder          = [];   // the block descriptions, ordered by their position in the queue

    this._nextQueueIndex = 0;
    this.pushToQueue("start", this.substitutedNodeList(startContent, "{}", "START"), "[]", "[]"); // initialize the queue
    this.slotNumber = 0;            //re-initialize each time the user chooses a new file

    while(this.blockRequestQueue.length>0) {     // keep consuming from the head and pushing to the tail
        var blockRequest        = this.blockRequestQueue.shift();

        var children            = blockRequest.children;
        var blockDisplayName    = blockRequest.blockDisplayName;
        var topList             = blockRequest.topList;
        var bottomList          = blockRequest.bottomList;
        var queueIndex          = blockRequest.queueIndex;

        var blockCode = "";   // Contains data sent by all the children merged together one after the other.

        for(var i=0;i<children.length;i++){
            blockCode += this.goDeeper(children[i], "{}", i , '', undefined);
        }

            // We want to always have a start block and here we force its blockCode to be unique
        if( blockDisplayName == "start" ) {
            blockCode += " ";
        }

        if( codeDict.hasOwnProperty(blockCode) ) {  // if we have created this block already, just merge the compatibility lists
                Array.prototype.push.apply( codeDict[blockCode].topList, topList);
                Array.prototype.push.apply( codeDict[blockCode].bottomList, bottomList);
                codeDict[blockCode].queueIndices.push( queueIndex );
        } else {    // otherwise create a new block

            codeDict[blockCode] = {
                "blockDisplayName"  : blockDisplayName,     // it is only a "suggested display name", we use numbers internally
                "blockCode"         : blockCode,
                "topList"           : topList,
                "bottomList"        : bottomList,
                "queueIndices"      : [ queueIndex ]        // at least one value, but more may be added in case of synonyms
            };
            blockOrder.push( codeDict[blockCode] );   // this is a reference to the same object, so that further modifications of topList and bottomList are seen
        }
    }

    this.toolboxXML      = "";
    this.allCode         = [];
    this.hue             = new HueGenerator();

    for (var blockOrderIndex=0; blockOrderIndex<blockOrder.length; blockOrderIndex++){
        var dictEntry   = blockOrder[blockOrderIndex];

        var blockDisplayName = dictEntry.blockDisplayName;
        var blockType       = "block_" + blockOrderIndex;
        var topText         = dictEntry.topList.length      ? "true, ["+dictEntry.topList.join()+"]"    : "false";
        var bottomText      = dictEntry.bottomList.length   ? "true, ["+dictEntry.bottomList.join()+"]" : "false";
        var queueIndices    = dictEntry.queueIndices;

        for (var i=0; i<queueIndices.length; i++){
            queueIndex_2_blockType[ queueIndices[i] ] = blockType;
        }
        blockTypeToDisplayNameMapper[blockType] = blockDisplayName;

        this.toolboxXML += "<block type='" + blockType + "'></block>";

        var blockCode = "Blockly.Blocks['" + blockType + "']={ init:function() {"
                    + "this.appendDummyInput().appendField('====[ " + blockType + ": " + blockDisplayName + " ]====');\n"
                    + dictEntry.blockCode
                    + "this.setPreviousStatement(" + topText + ");"
                    + "this.setNextStatement(" + bottomText + ");"
                    + "this.setColour(" + this.hue.generate() + ");"
                    + "}};";

        blockCode = blockCode.replace(/\n{2,}/g, "\n");
        this.allCode.push(blockCode);
    }
}


RNG2Blockly.prototype.substitutedNodeList = function(children, haveAlreadySeenStr, substContext) {
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
                var defKids = findOneNodeByTagAndName(this.rngDoc, "define", nodeName).childNodes;

                var substKids = this.substitutedNodeList(defKids, JSON.stringify(currChildHasSeen), nodeName);
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


RNG2Blockly.prototype.goDeeper = function(node, haveAlreadySeenStr, path, common_prefix, last_sibling) {
    if(currentlyCreatingOptiField == true && successfulOptiField == false){
        return null;
    }

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

        var displayName;

        if(node.parentNode.childNodes.length == 1 && node.parentNode.getAttribute("name")){
            displayName = this.getNodeDisplayName(node.parentNode);
            unicode_pattern = unicode_pattern_for_prev_level;
        } else{
            displayName = node.getAttribute("blockly:blockName") || "text";
        }

        blocklyCode += "this.appendDummyInput().appendField('" + unicode_pattern + "').appendField('"+displayName+"').appendField(new Blockly.FieldTextInput(''),'" + name + "');";

    }

	else if(nodeType == "element") {
        unicode_pattern_for_prev_level = unicode_pattern;

        var nodeName = node.getAttribute("name");
        var displayName = this.getNodeDisplayName(node);

        var name = path + "ELM_" + nodeName;
        var context = node.getAttribute("context");
        haveAlreadySeenStr = node.getAttribute("haveAlreadySeen");
        var children = this.substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);

        var singleChild = ['text', 'data', 'value'];
		if(! (children.length == 1 && children[0].nodeName.isOneOf(singleChild) ) ) {
            blocklyCode += "this.appendDummyInput().appendField('" + unicode_pattern + "').appendField('"+displayName+"');";  // a label for the (non-empty) parent
        }

		if(children.length == 1){
            var childData = this.goDeeper(children[0], haveAlreadySeenStr, name + '_' + 0, common_prefix+child_suffix, true );
                // childData will contain the parent element's name only if it is being returned by a choice containing values.
                // In that case, we need to remove the dummyInput+label that we had set for the element in the above if statement as the child itself sends the label also.
                // So, we replace blocklyCode with childData in this case otherwise we always add data returned by the child to blocklyCode.
                // Assumption: Consider an element which contains a choice, which, in turn, has a list of values as its children.
                // Assumption made is that such an element cannot have any other children along with choice+list of values.
			if( childData!=null && childData.indexOf("'" + displayName + "'") != -1 ){
				blocklyCode = childData;
			}else{
				blocklyCode += childData;
			}
		}else{
			for(var i=0;i<children.length;i++){
                var this_is_last_sibling = (i == children.length-1);
                blocklyCode += this.goDeeper(children[i], haveAlreadySeenStr, name + '_' + i , common_prefix+child_suffix, this_is_last_sibling);
            }
		}

    }


	else if(nodeType == "attribute") {
        unicode_pattern_for_prev_level = unicode_pattern;

        var nodeName = node.getAttribute("name");
        var displayName = this.getNodeDisplayName(node);

        var name = path + "ATT_" + nodeName;
        var context = node.getAttribute("context");
        haveAlreadySeenStr = node.getAttribute("haveAlreadySeen");
        var children = this.substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);

        if( children.length == 0 ){
			blocklyCode += "this.appendDummyInput().appendField('" + unicode_pattern + "').appendField('" + displayName + "').appendField(new Blockly.FieldTextInput(''),'" + name + "');";
		} else{
			for(var i=0;i<children.length;i++){
                var this_is_last_sibling = (i == children.length-1);
                blocklyCode += this.goDeeper(children[i], haveAlreadySeenStr, name + '_' + i , common_prefix+child_suffix, this_is_last_sibling);
			}
		}

            // if there are multiple children of an attribte (like two text tags), its name won't be added by its children and we need to add it here
        if( blocklyCode.indexOf("appendField('"+displayName) ==-1 ){
            var displayStatement = "this.appendDummyInput().appendField('" + unicode_pattern + "').appendField('" + displayName + "');";
            blocklyCode = displayStatement + blocklyCode;
        }
    }


	else if(nodeType == "group"){
		var context = node.getAttribute("context");
        var children = this.substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);
		var name = path + "GRO_";

        var displayName = this.getNodeDisplayName(node) || "group";
		blocklyCode = "this.appendDummyInput('"+name+"').appendField('" + unicode_pattern + "').appendField('"+displayName+"');";

		for(var i=0;i<children.length;i++){
            var this_is_last_sibling = (i == children.length-1);
            blocklyCode += this.goDeeper(children[i], haveAlreadySeenStr, name + i , common_prefix + child_suffix, this_is_last_sibling);
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
        var type        = node.getAttribute("type");
        var displayName = this.getNodeDisplayName(node.parentNode) + " (" + type + ")";
        var typeChecker = (type||'').isOneOf(numberTypes) ? "Blockly.FieldTextInput.numberValidator" : "null";
        var name        = path + "DAT_";

		blocklyCode += "this.appendDummyInput().appendField('" + unicode_pattern_for_prev_level + "').appendField('"+displayName+"').appendField(new Blockly.FieldTextInput('',"+ typeChecker +" ), '"+name+"');";
	}


	else if(nodeType == "choice") {
		var values = allChildrenValueTags(node);	//returns array of all values if all children are value tags, otherwise returns false
		if(values == false){
            if(currentlyCreatingOptiField){
                successfulOptiField = false;
                return null;
            }
            blocklyCode = this.handleMagicBlock(node, haveAlreadySeenStr, path, false, common_prefix, last_sibling, {});
		} else{
            //indentationLevel--; //as this one attaches itself at its parent's level
            var displayName = this.getNodeDisplayName(node.parentNode);
			blocklyCode = "this.appendDummyInput().appendField('" + unicode_pattern_for_prev_level + "').appendField('"+displayName+"').appendField(new Blockly.FieldDropdown(["+values+"]),'"+displayName+"');";
		}

    }

	else if(nodeType == "interleave"){
        if(currentlyCreatingOptiField){
            successfulOptiField = false;
            return null;
        }
        blocklyCode = this.handleMagicBlock(node, haveAlreadySeenStr, path, false, common_prefix, last_sibling, {});
	}

	else if(nodeType == "optional"){
        if(currentlyCreatingOptiField){
            successfulOptiField = false;
            return null;
        }

    	var context = node.getAttribute("context");
        //var context_child_idx = node.getAttribute("context_child_idx");
        var children = this.substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);
    	var name = path + nodeType.substring(0,3).toUpperCase() + ("_");
        currentlyCreatingOptiField = true;
        successfulOptiField = true;


        for(var i=0;i<children.length;i++){
            if(magicType.hasOwnProperty(children[i].nodeName)){
                successfulOptiField = false;
                break;
            } else{
                var this_is_last_sibling = (i == children.length-1);
                blocklyCode += this.goDeeper(children[i], haveAlreadySeenStr, name + i, common_prefix + child_suffix, this_is_last_sibling);
            }
        }

        //if optiField consists of only one child level, then we do not create a label for the optiField specifically.
        if(successfulOptiField){
            var count = blocklyCode.split("this.appendDummyInput");

            if(count.length == 2){
                var childPartToBeAdded = count[1].split(".appendField('"+common_prefix + child_suffix + last_branch+"')")[1];
                blocklyCode = "this.appendDummyInput('"+name+"').appendField('" + unicode_pattern + "').appendField(new Blockly.FieldCheckbox(\"TRUE\", checker), '"+name+"_checkbox')" + childPartToBeAdded;
            } else{
                blocklyCode = "this.appendDummyInput('"+name+"').appendField('" + unicode_pattern + "').appendField(new Blockly.FieldCheckbox(\"TRUE\", checker), '"+name+"_checkbox').appendField('"+name+"');" + blocklyCode;
            }

            blocklyCode += "this.appendDummyInput('" + name + "end_of_optiField').setVisible(false);";  //hidden field to detect end of optiField
            currentlyCreatingOptiField = false;

        } else{
            currentlyCreatingOptiField = false;
            blocklyCode = this.handleMagicBlock(node, haveAlreadySeenStr, path, false, common_prefix, last_sibling, {});
        }

	}

	else if(nodeType == "zeroOrMore"){
        if(currentlyCreatingOptiField){
            successfulOptiField = false;
            return null;
        }
        blocklyCode = this.handleMagicBlock(node, haveAlreadySeenStr, path, false, common_prefix, last_sibling, {});
	}

	else if(nodeType == "oneOrMore"){
        if(currentlyCreatingOptiField){
            successfulOptiField = false;
            return null;
        }
        blocklyCode = this.handleMagicBlock(node, haveAlreadySeenStr, path, false, common_prefix, last_sibling, {});
	}

    return blocklyCode + "\n";
}


//creates a notch in its parent block with a label for the magic block that has called it. Then creates a separate block for every child.
RNG2Blockly.prototype.handleMagicBlock = function(node, haveAlreadySeenStr, path, bottomNotchOverride, common_prefix, last_sibling, inheritedProperties){
    var nodeType = node.nodeName;
	var context = node.getAttribute("context");
    var context_child_idx = node.getAttribute("context_child_idx");
    var children = this.substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);
	var name = path + nodeType.substring(0,3).toUpperCase() + ("_");	//the second part gives strings like CHO_, INT_ and so on.

    var head_suffix = (last_sibling == undefined)? '': last_sibling? last_branch: non_last_branch;
    var child_suffix = (last_sibling == undefined)? '': last_sibling? last_child: non_last_child;
    var unicode_pattern = common_prefix + head_suffix;

    var properties = getNotchProperties(node, inheritedProperties);

    //each block created here will have a topnotch. It may or may not have a bottom notch depending on nodeType
    var topListStr      = "["+this.slotNumber+"]";
    var bottomListStr   = (bottomNotchOverride || magicType[nodeType].hasBottomNotch) ? topListStr : "[]";
    if(! node.hasAttribute("visited") ) {
        //Rule 1
        //if any magic node has another magic node as its only child, inline the child
        if(children.length == 1 && magicType.hasOwnProperty(children[0].nodeName)){
            blocklyCode = "this.appendDummyInput().appendField('" + unicode_pattern + "').appendField('"+name+"');";
            var childPath = name + '0';
            this.setVisitedAndSlotNumber(node);  //set only visited. Not slotNumber (done to prevent infinite loop)
            var child = children[0];

            if(bottomListStr != "[]"){
                //if current tag has bottom notch, propagate its bottom notch to children
                bottomNotchOverride = true;
            }else{
                bottomNotchOverride = false;
            }

            blocklyCode += this.handleMagicBlock(child, haveAlreadySeenStr, childPath, bottomNotchOverride, common_prefix+child_suffix, true, properties);
        }else{
            if( magicType[nodeType].hasSeparateKids ) {     //current node is choice or interleave
                var childrenDisplayNames = [];
                var childrenInfo = [];
                for(var i=0;i<children.length;i++){
                    var currentChild = children[i];
                    //var testBlockName  =  path + "_" + node.nodeName.substring(0,3) + "_cse" + i + context_child_idx ;

                    if(magicType.hasOwnProperty(currentChild.nodeName)){    // interleave or choice has magic child
                        var bottomForThisChild = (bottomListStr == "[]") ? false : true;
                        var bottom = ( bottomForThisChild || magicType[currentChild.nodeName].hasBottomNotch ) ? topListStr : "[]" ;
                        var currentContext = currentChild.getAttribute("context");
                        var childrenOfCurrentChild = this.substitutedNodeList(currentChild.childNodes, haveAlreadySeenStr, currentContext);

                        /*if(childrenOfCurrentChild.length == 1 && magicType.hasOwnProperty(childrenOfCurrentChild[0].nodeName)){
                            //var name = testBlockName + "_" + currentChild.nodeName.substring(0,3) + "_0" ;
                            var childPath = testBlockName + '0';
                            this.setVisitedAndSlotNumber(node);  //set only visited. Not slotNumber (done to prevent infinite loop)
                            var child = childrenOfCurrentChild[0];

                            if(bottom != "[]"){
                                //if current tag has bottom notch, propagate its bottom notch to children
                                bottom = true;
                            }else{
                                bottom = false;
                            }
                            dontIncrementSlot=true;

                            blocklyCode = this.handleMagicBlock(child, haveAlreadySeenStr, childPath, bottom, common_prefix+child_suffix, true);
                        }*/

                        if(magicType[currentChild.nodeName].hasSeparateKids){   //choice/interleave has choice/interleave as a child
                            var arrayOfChildren = [];
                            for(var j=0; j<childrenOfCurrentChild.length; j++){
                                var childBlockName = this.getNodeDisplayName(childrenOfCurrentChild[j], true);
                                childrenDisplayNames.push(childBlockName);
                                this.pushToQueue(childBlockName, [ childrenOfCurrentChild[j] ], topListStr, bottom);
                                arrayOfChildren.push(childBlockName);
                            }
                            if(currentChild.nodeName == "interleave"){ //if child does not have a bottom notch, it is interleave
                                childrenInfo.push(arrayOfChildren);
                            } else{             //if child is choice
                                if(node.nodeName == "choice"){
                                    for(var x=0;x<arrayOfChildren.length;x++){
                                        childrenInfo.push(arrayOfChildren[x]);
                                    }
                                } else{
                                    childrenInfo.push("startChoice_");
                                    for(var x=0;x<arrayOfChildren.length;x++){
                                        childrenInfo.push(arrayOfChildren[x]);
                                    }
                                    childrenInfo.push("_endChoice");
                                }
                            }

                        }else{        //choice/interleave has a oneOrMore/zeroOrMore/optional child
                            var childBlockName = this.getNodeDisplayName(currentChild, true);
                            childrenDisplayNames.push(childBlockName);
                            this.pushToQueue(childBlockName, childrenOfCurrentChild, topListStr, bottom);
                            childrenInfo.push( "startRepetition_" + currentChild.nodeName );
                            childrenInfo.push(childBlockName);
                            childrenInfo.push( "_endRepetition");
                        }
                    }
                    else{           //child of choice/interleave is a normal one
                        var childBlockName = this.getNodeDisplayName(currentChild, true);
                        childrenDisplayNames.push(childBlockName);
                        this.pushToQueue(childBlockName, [currentChild], topListStr, bottomListStr);
                        childrenInfo.push(childBlockName);
                    }
                }
                childrenDisplayNames = childrenDisplayNames.join(" " + magicType[node.nodeName].prettyIndicator + " ");
                node.setAttribute("name", childrenDisplayNames);
                blocklyCode = "this.appendStatementInput('"+this.slotNumber+"').setCheck(["+this.slotNumber+"]).appendField('" + unicode_pattern + "').appendField('"+childrenDisplayNames+"');";

                notchProperties[this.slotNumber] = getNotchProperties(node, inheritedProperties);
                if(childrenInfo.length > 0) {   // add childrenInfo if it is available
                    notchProperties[this.slotNumber].childrenInfo = JSON.parse(JSON.stringify(childrenInfo));
                }

                console.log(notchProperties[this.slotNumber]);
			} else{      //current node is oneOrMore, zeroOrMore, optional

                    var childBlockName = (children.length == 1)
                                            ? this.getNodeDisplayName(children[0], true)
                                            : this._nextQueueIndex;

                    this.pushToQueue(childBlockName, children, topListStr, bottomListStr);
                    node.setAttribute("name", childBlockName);
                    blocklyCode = "this.appendStatementInput('"+this.slotNumber+"').setCheck(["+this.slotNumber+"]).appendField('" + unicode_pattern + "').appendField('"+childBlockName + magicType[node.nodeName].prettyIndicator +"');";
                    notchProperties[this.slotNumber] = getNotchProperties(node, inheritedProperties);
                    console.log(notchProperties[this.slotNumber]);
            }

            this.setVisitedAndSlotNumber(node, this.slotNumber);

        }
    } else if(magicType[nodeType].hasLoopRisk) {
			alert("circular ref loop detected because of "+node.nodeName);
			blocklyCode = "this.appendDummyInput().appendField('***Circular Reference***');";
    } else {
			alert(node.nodeName + " " + context + "_" + node.nodeName.substring(0,3) + context_child_idx + " has been visited already, skipping");

            var assignedSlotNumber = node.getAttribute("slotNumber");
            var prettyName = node.getAttribute("name");
            blocklyCode = "this.appendStatementInput('"+this.slotNumber+"').setCheck(["+assignedSlotNumber+"]).appendField('" + unicode_pattern + "').appendField('"+prettyName+ magicType[node.nodeName].prettyIndicator +"');";
            //notchProperties[this.slotNumber] = getNotchProperties(node, inheritedProperties);
            notchProperties[this.slotNumber] = notchProperties[assignedSlotNumber];
            console.log(notchProperties[this.slotNumber]);
            this.slotNumber++;
	}
	return blocklyCode;
}

RNG2Blockly.prototype.pushToQueue = function(blockDisplayName, children, topListStr, bottomListStr) {
    this.blockRequestQueue.push({
        "blockDisplayName"  : blockDisplayName,
        "children"          : children,
        "topList"           : JSON.parse(topListStr),
        "bottomList"        : JSON.parse(bottomListStr),
        "queueIndex"        : this._nextQueueIndex
    } );
    this._nextQueueIndex++;
}

RNG2Blockly.prototype.setVisitedAndSlotNumber = function(node, slot) {
    node.setAttribute("visited", "true");
    if(slot != undefined){
        node.setAttribute("slotNumber", slot);
        this.slotNumber++;
    }
}


RNG2Blockly.prototype.getNodeDisplayName = function(node, tryEBN){
    return ( node.getAttribute("blockly:blockName") || node.getAttribute("name") || (tryEBN && this._nextQueueIndex) );
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


function getNotchProperties(node, inheritedProperties){
    var properties = JSON.parse(JSON.stringify(defaultProperties[node.nodeName]));;
    var inheritedPropertiesLength = Object.keys(inheritedProperties).length;
    var keys = ['isRepeatable' , 'shouldHaveOneBlock' , 'isGrouped'];
    if(inheritedPropertiesLength > 0){
        for(var i=0;i<1;i++){
            if(inheritedProperties[keys[i]] != undefined){
                properties[keys[i]] = inheritedProperties[keys[i]];
            }
        }
        properties['canBeEmpty'] = properties['canBeEmpty'] || inheritedProperties['canBeEmpty'];

        //if choice has ONLY interleave, it becomes an interleave. if interleave has ONLY choice, it becomes choice (works for optional as well. this property was added later for optional)
        if(inheritedProperties['shouldHaveOneBlock'] && properties['isGrouped']){
            properties['isGrouped'] = true;
        } else if(properties['shouldHaveOneBlock'] && inheritedProperties['isGrouped']){
            properties['shouldHaveOneBlock'] = true;
        }
    }

    return properties;
}



/*
 * Helper methods to process the RNG document
 *********************************************/

//Removes #text nodes
//These are string elements present in the XML document between tags. The
//RNG specification only allows these strings to be composed of whitespace
//except inside <value>
function removeRedundantText(node) {
    _removeNodesRecursively(node, function(n, p) {return n.nodeName == "#text" && p.nodeName != "value"});
}

// Remove #comment nodes because they we want to exclude them from children.length
function removeXMLComments(node) {
    _removeNodesRecursively(node, function(n, p) {return n.nodeName == "#comment"});
}

// Generic method to remove all the nodes that match a condition
function _removeNodesRecursively(node, canRemove) {
	var children=node.childNodes;
	for(var i=0;i<children.length;i++){
		if (canRemove(children[i], node)) {
			children[i].parentNode.removeChild(children[i]);
			i--;
		}else{
			_removeNodesRecursively(children[i], canRemove);
		}
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
