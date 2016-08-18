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

var notchProperties = {};
var cleanRNG;

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


function RNG2Blockly(rngDoc) {
    this.rngDoc = rngDoc;

    var rootElement = rngDoc.documentElement;
    var startContent = (rootElement.nodeName == "grammar")
        ? rngDoc.getElementsByTagName("start")[0].childNodes
        : [ rootElement ];

    removeRedundantText(rootElement);
    removeXMLComments(rootElement);
    cleanRNG = rootElement;

    var codeDict            = {};   // maps block names to the code (to be reviewed)
    this.blockRequestQueue  = [];   // a queue that holds requests to create new blocks
    var blockOrder          = [];   // the block descriptions, ordered by their position in the queue

    this._nextQueueIndex = 0;
    this.pushToQueue("start", this.substitutedNodeList(startContent, "{}", "START"), "[]", "[]"); // initialize the queue
    this.slotNumber = 0;            //re-initialize each time the user chooses a new file
    this.uni = new UnicodeIndenter();

    while(this.blockRequestQueue.length>0) {     // keep consuming from the head and pushing to the tail
        var blockRequest        = this.blockRequestQueue.shift();

        var children            = blockRequest.children;
        var blockDisplayName    = blockRequest.blockDisplayName;
        var topList             = blockRequest.topList;
        var bottomList          = blockRequest.bottomList;
        var queueIndex          = blockRequest.queueIndex;

        var blockCode = "";   // Contains data sent by all the children merged together one after the other.

        this.uni.reset();

        this.successfulOptiField            = false;    //true or false depending on whether optiField can be created or not
        this.currentlyCreatingOptiField     = false;

        for(var i=0;i<children.length;i++){
            blockCode += this.goDeeper(children[i], "{}", i);
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

    this.queueIndex_2_blockType         = {};
    this.blockTypeToDisplayNameMapper   = {};

    for (var blockOrderIndex=0; blockOrderIndex<blockOrder.length; blockOrderIndex++){
        var dictEntry   = blockOrder[blockOrderIndex];

        var blockDisplayName = dictEntry.blockDisplayName;
        var blockType       = "block_" + blockOrderIndex;
        var topText         = dictEntry.topList.length      ? "true, ["+dictEntry.topList.join()+"]"    : "false";
        var bottomText      = dictEntry.bottomList.length   ? "true, ["+dictEntry.bottomList.join()+"]" : "false";
        var queueIndices    = dictEntry.queueIndices;

        for (var i=0; i<queueIndices.length; i++){
            this.queueIndex_2_blockType[ queueIndices[i] ] = blockType;
        }
        this.blockTypeToDisplayNameMapper[blockType] = blockDisplayName;

        this.toolboxXML += "<block type='" + blockType + "'></block>";

        var blockCode = "Blockly.Blocks['" + blockType + "']={ init:function() {"
                    + this.makeBlocklyCode_UnindentedLabel( "====[ " + blockType + ": " + blockDisplayName + " ]====" ) + "\n"
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


RNG2Blockly.prototype.goDeeper = function(node, haveAlreadySeenStr, path) {
    if(this.currentlyCreatingOptiField == true && this.successfulOptiField == false){
        return null;
    }

    var nodeType = (node == null) ? "null" : node.nodeName;
    var context = (node == null) ? undefined : node.getAttribute("context");

	var blocklyCode = ""; // Contains data sent by all the children merged together one after the other.

    if(nodeType == "null") {

        blocklyCode = this.makeBlocklyCode_UnindentedLabel("*** CIRCULAR REFERENCE ***");   // FIXME: can we escape directly out of the recursion in JS?

    }

	else if(nodeType == "text") {

        var name = path + "TXT";
        var displayName = this.getNodeDisplayName(node);

        blocklyCode += this.makeBlocklyCode_TextField(displayName, name);

    }

    else if ((nodeType == "element") || (nodeType == "attribute")) {

        var nodeName = node.getAttribute("name");
        var displayName = this.getNodeDisplayName(node);

        var name = path + (nodeType == "element" ? "ELM" : "ATT") + "_" + nodeName;
        haveAlreadySeenStr = node.getAttribute("haveAlreadySeen");
        var children = this.substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);

        if( children.length == 0 ){

            if (nodeType == "element") {
                blocklyCode = this.makeBlocklyCode_Label(displayName);
            } else {
                blocklyCode = this.makeBlocklyCode_TextField(displayName, name);
            }

        } else if ((children.length == 1) && (children[0].nodeName == "text")) {

            blocklyCode = this.makeBlocklyCode_TextField(displayName, name);

        } else if ((children.length == 1) && (children[0].nodeName == "data")) {

            // TODO currently data ignores any <param> tags that it may contain
            var type        = children[0].getAttribute("type");
            var typeChecker = (type||'').isOneOf(numberTypes) ? "Blockly.FieldTextInput.numberValidator" : "null";

            if (type) {
                displayName += " (" + type + ")";
            }

            blocklyCode = this.makeBlocklyCode_TextField(displayName, name, typeChecker);

        // FIXME: We shouldn't be calling allChildrenValueTags() twice
        } else if ((children.length == 1) && (children[0].nodeName == "choice") && allChildrenValueTags(children[0])) {

            var values = allChildrenValueTags(children[0]);     //returns array of all values if all children are value tags, otherwise returns false
            blocklyCode = this.makeBlocklyCode_DropDown(displayName, name, values);

        } else {

            blocklyCode = this.goDeeper_makeTreeWithKids(displayName, children, haveAlreadySeenStr, name);
        }
    }


	else if(nodeType == "group"){
        haveAlreadySeenStr = node.getAttribute("haveAlreadySeen");
        var children = this.substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);
		var name = path + "GRO_";

        var displayName = this.getNodeDisplayName(node);

        if (displayName) {
            blocklyCode = this.goDeeper_makeTreeWithKids(displayName, children, haveAlreadySeenStr, name);
        } else {
            blocklyCode = this.goDeeper_iterateOverKids(children, haveAlreadySeenStr, name);
        }
    }

	else if(nodeType == "optional"){
        if(this.currentlyCreatingOptiField){
            this.successfulOptiField = false;
            return null;
        }

        //var context_child_idx = node.getAttribute("context_child_idx");
        var children = this.substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);
        var name = path + "OPT_";
        this.currentlyCreatingOptiField = true;
        this.successfulOptiField = true;


        for(var i=0;i<children.length;i++){
            if(magicType.hasOwnProperty(children[i].nodeName)){
                this.successfulOptiField = false;
            } else if (children.length > 1) {
                this.uni.indent( i == children.length-1 );
                blocklyCode += this.goDeeper(children[i], haveAlreadySeenStr, name + i);
                this.uni.unindent();
            } else {
                blocklyCode += this.goDeeper(children[i], haveAlreadySeenStr, name + i);
            }
            if (!this.successfulOptiField) {
                break;
            }
        }

        //if optiField consists of only one child level, then we do not create a label for the optiField specifically.
        if(this.successfulOptiField){

            var displayName = this.getNodeDisplayName(node);
            if (children.length == 1){
                // FIXME: we shouldn't have to split the Blockly code
                var xxx = blocklyCode.indexOf('.appendField(', 28); // to skip the first one
                var childPartToBeAdded = blocklyCode.substring(xxx);
                blocklyCode = this.makeBlocklyCode_OptiField(displayName, name, childPartToBeAdded, false);
            } else{
                blocklyCode = this.makeBlocklyCode_OptiField(displayName, name, blocklyCode, true);
            }

        } else{
            blocklyCode = this.handleMagicTag(node, haveAlreadySeenStr, path, false, {});
        }

        this.currentlyCreatingOptiField = false;

	}

    else if (magicType.hasOwnProperty(nodeType)) {      // interleave, zeroOrMore, oneOrMore, and some choice
        if(this.currentlyCreatingOptiField){
            this.successfulOptiField = false;
            return null;
        }
        blocklyCode = this.handleMagicTag(node, haveAlreadySeenStr, path, false, {});
	}

    else {
        blocklyCode = this.makeBlocklyCode_Label("unhandled '" + nodeType + "' tag");
    }

    return blocklyCode + "\n";
}

RNG2Blockly.prototype.goDeeper_makeTreeWithKids = function(headerName, children, haveAlreadySeenStr, path) {
    var blocklyCode = this.makeBlocklyCode_Label(headerName);
    for(var i=0;i<children.length;i++){
        this.uni.indent( i == children.length-1 );
        blocklyCode += this.goDeeper(children[i], haveAlreadySeenStr, path + "_" + i);
        this.uni.unindent();
    }
    return blocklyCode;
}

RNG2Blockly.prototype.goDeeper_iterateOverKids = function(children, haveAlreadySeenStr, path) {
    var blocklyCode = "";
    for(var i=0;i<children.length;i++){
        blocklyCode += this.goDeeper(children[i], haveAlreadySeenStr, path + "_" + i);
    }
    return blocklyCode;
}


/*
 * Helper methods to generate Blockly code
 ******************************************/

RNG2Blockly.prototype.makeBlocklyCode_UnindentedLabel = function(label) {
    return "this.appendDummyInput().appendField('" + label + "');";
};

RNG2Blockly.prototype.makeBlocklyCode_Label = function(label) {
    return "this.appendDummyInput().appendField('" + this.uni.getIndentation() + "').appendField('" + label + "');";
};

RNG2Blockly.prototype.makeBlocklyCode_TextField = function(label, internalName, typeChecker) {
    // There could be another parameter for the initial value
    return "this.appendDummyInput().appendField('" + this.uni.getIndentation() + "').appendField('" + label + "').appendField(new Blockly.FieldTextInput(''" + (typeChecker ? "," + typeChecker : "") + "),'" + internalName + "');";
};

RNG2Blockly.prototype.makeBlocklyCode_DropDown = function(label, internalName, values) {
    return "this.appendDummyInput().appendField('" + this.uni.getIndentation() + "').appendField('" + label + "').appendField(new Blockly.FieldDropdown([" + values + "]),'" + internalName + "');";
};

RNG2Blockly.prototype.makeBlocklyCode_OptiField = function(label, internalName, content, needLabel) {
    var code = "this.appendDummyInput('" + internalName + "').appendField('" + this.uni.getIndentation() + "').appendField(new Blockly.FieldCheckbox(\"TRUE\", checker), '" + internalName + "_checkbox')";
    if (needLabel) {
        code += ".appendField('" + label + "');" + content;
    } else {
        code += content;
    }
    return code + "this.appendDummyInput('" + internalName + "end_of_optiField').setVisible(false);";  //hidden field to detect end of optiField
};

RNG2Blockly.prototype.makeBlocklyCode_StatementInput = function(slotSignature, internalSlotName, slotRuleToMatchWithIncomingNotch) {
    return "this.appendStatementInput('" + internalSlotName + "').setCheck(['" + slotRuleToMatchWithIncomingNotch + "']).appendField('" + this.uni.getIndentation() + "').appendField('" + slotSignature + "');";
};



    //creates a notch in its parent block with a label for the magic block that has called it. Then creates a separate block for every child.
RNG2Blockly.prototype.handleMagicTag = function(node, haveAlreadySeenStr, path, bottomNotchOverride, inheritedProperties){
    var nodeType = node.nodeName;
	var context = node.getAttribute("context");
    var context_child_idx = node.getAttribute("context_child_idx");
    var children = this.substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);
	var name = path + nodeType.substring(0,3).toUpperCase() + ("_");	//the second part gives strings like CHO_, INT_ and so on.

    var properties = getNotchProperties(node, inheritedProperties);
    var blocklyCode = "";

    //each block created here will have a top notch. It may or may not have a bottom notch depending on nodeType
    var topListStr      = "["+this.slotNumber+"]";
    var bottomListStr   = (bottomNotchOverride || magicType[nodeType].hasBottomNotch) ? topListStr : "[]";
    if(! node.hasAttribute("visited") ) {
        //Rule 1
        //if any magic node has another magic node as its only child, inline the child
        if(children.length == 1 && magicType.hasOwnProperty(children[0].nodeName)){
            blocklyCode = this.makeBlocklyCode_Label(name);
            var childPath = name + '0';
            this.setVisitedAndSlotNumber(node);  //set only visited. Not slotNumber (done to prevent infinite loop)
            var child = children[0];

            this.uni.indent(true);
                //if current tag has bottom notch, propagate its bottom notch to children
            blocklyCode += this.handleMagicTag(child, haveAlreadySeenStr, childPath, (bottomListStr != "[]"), properties);
            this.uni.unindent();
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
                var slotSignature = childrenDisplayNames.join(" " + magicType[node.nodeName].prettyIndicator + " ");
                node.setAttribute("name", slotSignature);
                blocklyCode = this.makeBlocklyCode_StatementInput(slotSignature, this.slotNumber, this.slotNumber);

                notchProperties[this.slotNumber] = getNotchProperties(node, inheritedProperties);
                if(childrenInfo.length > 0) {   // add childrenInfo if it is available
                    notchProperties[this.slotNumber].childrenInfo = JSON.parse(JSON.stringify(childrenInfo));
                }

                console.log(notchProperties[this.slotNumber]);
			} else {      //current node is oneOrMore, zeroOrMore, optional

                    var childBlockName = (children.length == 1)
                                            ? this.getNodeDisplayName(children[0], true)
                                            : this._nextQueueIndex;

                    this.pushToQueue(childBlockName, children, topListStr, bottomListStr);
                    var slotSignature = childBlockName + magicType[node.nodeName].prettyIndicator;
                    node.setAttribute("name", slotSignature);
                    blocklyCode = this.makeBlocklyCode_StatementInput(slotSignature, this.slotNumber, this.slotNumber);
                    notchProperties[this.slotNumber] = getNotchProperties(node, inheritedProperties);
                    console.log(notchProperties[this.slotNumber]);
            }

            this.setVisitedAndSlotNumber(node, this.slotNumber);

        }
    } else if(magicType[nodeType].hasLoopRisk) {
			alert("circular ref loop detected because of "+node.nodeName);
            blocklyCode = this.makeBlocklyCode_UnindentedLabel("***Circular Reference***");
    } else {
			alert(node.nodeName + " " + context + "_" + node.nodeName.substring(0,3) + context_child_idx + " has been visited already, skipping");

            var assignedSlotNumber = node.getAttribute("slotNumber");
            var slotSignature = node.getAttribute("name");
            blocklyCode = this.makeBlocklyCode_StatementInput(slotSignature, this.slotNumber, assignedSlotNumber);
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
    return ( node.getAttribute("blockly:blockName") || node.getAttribute("name") || (tryEBN ? this._nextQueueIndex : ("(unnamed " + node.nodeName + ")")) );
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
