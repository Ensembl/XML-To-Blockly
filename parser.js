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


var numberTypes=[ 'int' , 'integer' , 'double' , 'float' , 'decimal' , 'number' ];

var blockStructureDict;
var validatorDict;

function RNG2Blockly(rngDoc) {
    this.rngDoc = rngDoc;

    var rootElement = rngDoc.documentElement;
    var startContent = (rootElement.nodeName == "grammar")
        ? rngDoc.getElementsByTagName("start")[0].childNodes
        : [ rootElement ];

    removeRedundantText(rootElement);
    removeXMLComments(rootElement);
    cleanRNG = rootElement;

    var codeDict            = new CodeDict(this);   // Structure to store non-redundant pieces of Bockly code
    this.blockRequestQueue  = [];   // a queue that holds requests to create new blocks

    this._nextQueueIndex = 0;
    this.pushToQueue("start", this.substitutedNodeList(startContent, "{}", "START"), "[]", "[]"); // initialize the queue
    this.uni = new UnicodeIndenter();

    while(this.blockRequestQueue.length>0) {     // keep consuming from the head and pushing to the tail
        var blockRequest        = this.blockRequestQueue.shift();

        var children            = blockRequest.children;
        var blockDisplayName    = blockRequest.blockDisplayName;
        this.currentQueueIndex  = blockRequest.queueIndex;
        var blockCode           = "";   // Contains data sent by all the children merged together one after the other.

        this.localSlotNumber    = 1;    // base_1 is more convenient for eyeballing
        this.blockValidationDict = {}

        this.uni.reset();

        this.successfulOptiField            = false;    //true or false depending on whether optiField can be created or not
        this.currentlyCreatingOptiField     = false;

        var xmlStructureForBlock = [];
        for(var i=0;i<children.length;i++){
            blockCode += this.goDeeper(children[i], "{}", i, xmlStructureForBlock);
        }
        //console.log(xmlStructureForBlock);

            // We want to always have a start block and here we force its blockCode to be unique
        if( blockDisplayName == "start" ) {
            blockCode += " ";
        }

        var candidateDictEntry = {
            "blockDisplayName"  : blockDisplayName,             // it is only a "suggested display name", we use numbers internally
            "blockCode"         : blockCode,
            "topList"           : blockRequest.topList,
            "bottomList"        : blockRequest.bottomList,
            "queueIndices"      : [ this.currentQueueIndex ],    // at least one value, but more may be added in case of synonyms
            "blockStructure"    : xmlStructureForBlock,
            "blockValidationDict"   : JSON.stringify(this.blockValidationDict)  // We can substitute queue-index macros
        };

        codeDict.mergeIfPossibleOtherwiseAdd(candidateDictEntry);
    }

    this.toolboxXML      = "";
    this.allCode         = [];
    this.hue             = new HueGenerator();

    var queueIndex_2_blockType          = {};   // Caution: this.queueIndex_2_blockType did not work in the replacer() callback
    var blockTypeToDisplayNameMapper    = {};

        // blockOrder contains entries of codeDict sorted by the youngest queueIndex
    var blockOrder = codeDict.getAllEntries().sort( function(a,b) { return string_cmp(a.queueIndices[0],b.queueIndices[0]); } );

    blockStructureDict = {};
    validatorDict = {};

    for (var blockOrderIndex=0; blockOrderIndex<blockOrder.length; blockOrderIndex++){
        var dictEntry       = blockOrder[blockOrderIndex];
        var queueIndices    = dictEntry.queueIndices;
        var blockDisplayName = dictEntry.blockDisplayName;
        var blockType       = "block_" + blockOrderIndex;
        var blockStructure  = dictEntry.blockStructure;

        dictEntry.blockType = blockType;

        for (var i=0; i<queueIndices.length; i++){
            queueIndex_2_blockType[ queueIndices[i] ] = blockType;
        }
        blockTypeToDisplayNameMapper[blockType] = dictEntry.blockDisplayName;
        blockStructureDict[blockType]           = blockStructure;
    }
    console.log(JSON.stringify(queueIndex_2_blockType));
    console.log(JSON.stringify(blockTypeToDisplayNameMapper));
    console.log(blockStructureDict);

    for (var blockOrderIndex=0; blockOrderIndex<blockOrder.length; blockOrderIndex++){
        var dictEntry       = blockOrder[blockOrderIndex];

        var blockDisplayName = dictEntry.blockDisplayName;
        var blockType       = dictEntry.blockType;
        var topText         = dictEntry.topList.length      ? "true, ["+dictEntry.topList.map(      function(x) {return "'"+x+"'";}, this).join()+"]" : "false";
        var bottomText      = dictEntry.bottomList.length   ? "true, ["+dictEntry.bottomList.map(   function(x) {return "'"+x+"'";}, this).join()+"]" : "false";

        this.toolboxXML += "<block type='" + blockType + "'></block>";

        var blockCode = "Blockly.Blocks['" + blockType + "']={ init:function() {"
                    + this.makeBlocklyCode_UnindentedLabel( "====[ " + blockType + ": " + blockDisplayName + " ]====" ) + "\n"
                    + dictEntry.blockCode
                    + "this.setPreviousStatement(" + topText + ");"
                    + "this.setNextStatement(" + bottomText + ");"
                    + "this.setColour(" + this.hue.generate() + ");"
                    + "}};";

        blockCode = blockCode.replace(/SUBSTITUTE_QUEUE_INDEX_(\d+)_/g, function replacer(match, $1) {
            var blockType   = queueIndex_2_blockType[$1];
            var displayName = blockTypeToDisplayNameMapper[blockType];
            return (displayName && !displayName.match(/SUBSTITUTE_QUEUE_INDEX_/)) ? displayName : blockType;
        } );

        var blockValidationDict = JSON.parse(dictEntry.blockValidationDict.replace(/QUEUE_INDEX_(\d+)_/g, function replacer(match, $1) {
            return queueIndex_2_blockType[$1];
        } ));
        validatorDict[blockType] = {};
        var keys = Object.keys(blockValidationDict);
        for(var i=0; i<keys.length; i++) {
            var k = keys[i];
            validatorDict[blockType][k] = new Validator(blockValidationDict[k]);
        }

        blockCode = blockCode.replace(/\n{2,}/g, "\n");
        this.allCode.push(blockCode);
    }
    console.log(validatorDict);
}


/*
 * CodeDict is a dictionary that indexes code entries directly but also
 * after replacing their own queue-index macro with "SELF_REFERENCE".
 *
 * All the usual methods of a dictionary have been reimplemented to take
 * both keys into account
 */


function CodeDict() {
    this._codeDict = {};
    this._codeWithSelfReferencesDict = {};
}

// Helper method that does the SELF_REFERENCE substitution
CodeDict.prototype._codeWithSelfReferences = function(dictEntry) {
    var queueIndex         = dictEntry.queueIndices[0];   // only the youngest (CHECKME: is this right?)
    var queueIndexMacro    = makeQueueIndexMacro( queueIndex );
    var blockCode          = dictEntry.blockCode.replace(new RegExp(queueIndexMacro, "g"), 'SELF_REFERENCE');

    return blockCode;
}

CodeDict.prototype.addEntry = function(dictEntry) {
    var blockCodeWithSelfReferences = this._codeWithSelfReferences(dictEntry);

    this._codeWithSelfReferencesDict[blockCodeWithSelfReferences] = dictEntry;
    this._codeDict[dictEntry.blockCode] = dictEntry;
}

CodeDict.prototype.deleteEntry = function(dictEntry) {
    var blockCodeWithSelfReferences = this._codeWithSelfReferences(dictEntry);

    delete this._codeDict[dictEntry.blockCode];
    delete this._codeWithSelfReferencesDict[blockCodeWithSelfReferences];
}

CodeDict.prototype.containsEntry = function(dictEntry) {
    var blockCodeWithSelfReferences = this._codeWithSelfReferences(dictEntry);

    return this._codeDict.hasOwnProperty(dictEntry.blockCode) || this._codeWithSelfReferencesDict.hasOwnProperty(blockCodeWithSelfReferences);
}

CodeDict.prototype.getEntry = function(dictEntry) {
    var blockCodeWithSelfReferences = this._codeWithSelfReferences(dictEntry);

    return this._codeDict[dictEntry.blockCode] || this._codeWithSelfReferencesDict[blockCodeWithSelfReferences];
}

CodeDict.prototype.getAllEntries = function() {
    return this._codeDict.getAllValues();
}

    // attempt to merge the candidate
CodeDict.prototype.mergeIfPossibleOtherwiseAdd = function(candidateDictEntry) {

    var candidateQueueIndex         = candidateDictEntry.queueIndices[0];   // only the youngest (CHECKME: is this right?)
    var candidateQueueIndexMacro    = makeQueueIndexMacro( candidateQueueIndex );

    if (this.containsEntry(candidateDictEntry)) {   // if we have created such a block already, just merge the compatibility lists
        var foundEntry              = this.getEntry(candidateDictEntry);
        var foundQueueIndex         = foundEntry.queueIndices[0];
        var foundQueueIndexMacro    = makeQueueIndexMacro( foundQueueIndex );

        foundEntry.topList.union(      candidateDictEntry.topList, true );
        foundEntry.bottomList.union(   candidateDictEntry.bottomList, true );
        foundEntry.queueIndices.union( [candidateQueueIndex], true );

        console.log("Recognition: when attempting to create block "+candidateQueueIndexMacro+" recognized it as "+foundQueueIndexMacro);

            var blockReverseOrder = this.getAllEntries().sort( function(a,b) { return string_cmp(b.queueIndices[0],a.queueIndices[0]); } );
            for(var i=0; i<blockReverseOrder.length; i++) {     // go through already generated blocks
                generatedBlockCode = blockReverseOrder[i];

                if(generatedBlockCode.blockCode.indexOf(candidateQueueIndexMacro) > -1) {     // does it mention our newly recognized friend?
                        // detach the matched entry
                    var stashedDictEntry = generatedBlockCode;
                    this.deleteEntry(generatedBlockCode);

                        // update the code of the matched entry
                    stashedDictEntry.blockCode  = generatedBlockCode.blockCode.replace(new RegExp(candidateQueueIndexMacro, "g"), foundQueueIndexMacro);  // used RegExp to benefit from /g

                    this.addEntry(stashedDictEntry);
                    //this.mergeIfPossibleOtherwiseAdd(stashedDictEntry);
                }
            }

        return true;
    } else {
        this.addEntry(candidateDictEntry);

        return false;
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


RNG2Blockly.prototype.goDeeper = function(node, haveAlreadySeenStr, path, currentPathStructure) {
    if(this.currentlyCreatingOptiField == true && this.successfulOptiField == false){
        return null;
    }

    var nodeType = (node == null) ? "null" : node.nodeName;
    var context = (node == null) ? undefined : node.getAttribute("context");
    var name = getInternalName(node, path);
    var addNodeDetailsToStructure = true;
    //internalName and displayName are added later
    var nodeDetails = new NodeDetails(nodeType);
    /*if(currentPathStructure){   //since we have not introduces currentPathStructure in all goDeeper calls yet
        currentPathStructure.push(nodeDetails);
    }*/

	var blocklyCode = ""; // Contains data sent by all the children merged together one after the other.

    if(nodeType == "null") {

        blocklyCode = this.makeBlocklyCode_UnindentedLabel("*** CIRCULAR REFERENCE ***");   // FIXME: can we escape directly out of the recursion in JS?

    }

	else if(nodeType == "text") {
        nodeDetails.internalName = name;

        var displayName = this.getNodeDisplayNameOrDefaultLabel(node);

        blocklyCode += this.makeBlocklyCode_TextField(displayName, name);

    }

    else if ((nodeType == "element") || (nodeType == "attribute")) {

        var displayName = this.getNodeDisplayNameOrDefaultLabel(node);
        nodeDetails.displayName = displayName;

        haveAlreadySeenStr = node.getAttribute("haveAlreadySeen");
        var children = this.substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);
        var allValueTags = "";

        if( children.length == 0 ){

            if (nodeType == "element") {
                blocklyCode = this.makeBlocklyCode_Label(displayName);
            } else {
                blocklyCode = this.makeBlocklyCode_TextField(displayName, name);
                nodeDetails.appendContentAtChildLevel("text" , name);
            }

        } else if ((children.length == 1) && (children[0].nodeName == "text")) {

            blocklyCode = this.makeBlocklyCode_TextField(displayName, name);
            nodeDetails.appendContentAtChildLevel("text" , name);

        } else if ((children.length == 1) && (children[0].nodeName == "data")) {

            // TODO currently data ignores any <param> tags that it may contain
            var type        = children[0].getAttribute("type");
            var typeChecker = (type||'').isOneOf(numberTypes) ? "Blockly.FieldTextInput.numberValidator" : "null";

            if (type) {
                displayName += " (" + type + ")";
            }

            blocklyCode = this.makeBlocklyCode_TextField(displayName, name, typeChecker);
            nodeDetails.appendContentAtChildLevel( "text" , name );

    } else if ((children.length == 1) && (children[0].nodeName == "choice") && (allValueTags = allChildrenValueTags(children[0]))!=false ) {

            var values = allValueTags;     //contains array of all values if all children are value tags
            blocklyCode = this.makeBlocklyCode_DropDown(displayName, name, values);
            nodeDetails.appendContentAtChildLevel( "text" , name );

        } else {    //we expect to reach here only if the node is an 'element' node
            var childrenStructureInfo = [];
            blocklyCode = this.goDeeper_makeTreeWithKids(displayName, children, haveAlreadySeenStr, name, childrenStructureInfo);
            if(currentPathStructure){   //since we have not introduces currentPathStructure in all goDeeper calls yet
                nodeDetails.content = childrenStructureInfo;
            }
        }
    }


	else if(nodeType == "group"){
        addNodeDetailsToStructure = false;
        haveAlreadySeenStr = node.getAttribute("haveAlreadySeen");
        var children = this.substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);

        var displayName = this.getNodeDisplayName(node);

        if (displayName) {
            blocklyCode = this.goDeeper_makeTreeWithKids(displayName, children, haveAlreadySeenStr, name, currentPathStructure);
        } else {
            blocklyCode = this.goDeeper_iterateOverKids(children, haveAlreadySeenStr, name, currentPathStructure);
        }
    }

	else if(nodeType == "optional"){
        if(this.currentlyCreatingOptiField){
            this.successfulOptiField = false;
            return null;
        }

        //var context_child_idx = node.getAttribute("context_child_idx");
        var children = this.substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);
        this.currentlyCreatingOptiField = true;
        this.successfulOptiField = true;

        /* collect data of the children level in childrenStructureInfo and push to currentPathStructure in case optiField is created.
         * If it is not an optiField, we send currentPathStructure to handleMagicTag.
         */
        var childrenStructureInfo = [];

        for(var i=0;i<children.length;i++){
            if(magicType.hasOwnProperty(children[i].nodeName)){
                this.successfulOptiField = false;
            } else if (children.length > 1) {
                this.uni.indent( i == children.length-1 );
                blocklyCode += this.goDeeper(children[i], haveAlreadySeenStr, name + i, childrenStructureInfo);
                this.uni.unindent();
            } else {
                blocklyCode += this.goDeeper(children[i], haveAlreadySeenStr, name + i, childrenStructureInfo);
            }
            if (!this.successfulOptiField) {
                break;
            }
        }

        //if optiField consists of only one child level, then we do not create a label for the optiField specifically.
        if(this.successfulOptiField){
            //addNodeDetailsToStructure = false;
            //currentPathStructure.push.apply( currentPathStructure , childrenStructureInfo );
            nodeDetails.tagName = "optiField";
            nodeDetails.internalName = name + "_checkbox";
            nodeDetails.content = childrenStructureInfo;
            var displayName = this.getNodeDisplayNameOrDefaultLabel(node);
            if (children.length == 1){
                // FIXME: we shouldn't have to split the Blockly code
                var xxx = blocklyCode.indexOf('.appendField(', 28); // to skip the first one
                var childPartToBeAdded = blocklyCode.substring(xxx);
                blocklyCode = this.makeBlocklyCode_OptiField(displayName, name, childPartToBeAdded, false);
            } else{
                blocklyCode = this.makeBlocklyCode_OptiField(displayName, name, blocklyCode, true);
            }

        } else{
            nodeDetails.tagName = "slot";
            var validationDetails = [];
            blocklyCode = this.handleMagicTag(node, haveAlreadySeenStr, path, false, validationDetails, nodeDetails);
            this.blockValidationDict[nodeDetails.internalName] = validationDetails[0];
        }

        this.currentlyCreatingOptiField = false;

	}

    else if (magicType.hasOwnProperty(nodeType)) {      // interleave, zeroOrMore, oneOrMore, and some choice
        if(this.currentlyCreatingOptiField){
            this.successfulOptiField = false;
            return null;
        }
        nodeDetails.tagName = "slot";
        var validationDetails = [];
        blocklyCode = this.handleMagicTag(node, haveAlreadySeenStr, path, false, validationDetails, nodeDetails);
        this.blockValidationDict[nodeDetails.internalName] = validationDetails[0];
	}

    else {
        blocklyCode = this.makeBlocklyCode_Label("unhandled '" + nodeType + "' tag");
    }

    if(addNodeDetailsToStructure){
        currentPathStructure.push(nodeDetails);
    }
    return blocklyCode + "\n";
}

RNG2Blockly.prototype.goDeeper_makeTreeWithKids = function(headerName, children, haveAlreadySeenStr, path, currentPathStructure) {
    var blocklyCode = this.makeBlocklyCode_Label(headerName);
    for(var i=0;i<children.length;i++){
        this.uni.indent( i == children.length-1 );
        blocklyCode += this.goDeeper(children[i], haveAlreadySeenStr, path + "_" + i, currentPathStructure);
        this.uni.unindent();
    }
    return blocklyCode;
}

RNG2Blockly.prototype.goDeeper_iterateOverKids = function(children, haveAlreadySeenStr, path, currentPathStructure) {
    var blocklyCode = "";
    for(var i=0;i<children.length;i++){
        blocklyCode += this.goDeeper(children[i], haveAlreadySeenStr, path + "_" + i, currentPathStructure);
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

RNG2Blockly.prototype.makeBlocklyCode_StatementInput = function(slotSignature, slotRuleToMatchWithIncomingNotch, nodeDetails) {
    var internalSlotName = 'slot_' + this.localSlotNumber++;
    nodeDetails.internalName = internalSlotName;
    return "this.appendStatementInput('" + internalSlotName + "').setCheck(['" + slotRuleToMatchWithIncomingNotch + "']).appendField('" + this.uni.getIndentation() + "').appendField('" + slotSignature + "');";
};



    //creates a notch in its parent block with a label for the magic block that has called it. Then creates a separate block for every child.
RNG2Blockly.prototype.handleMagicTag = function(node, haveAlreadySeenStr, path, bottomNotchOverride, validationDetails, nodeDetails){
    var nodeType = node.nodeName;
	var context = node.getAttribute("context");
    var context_child_idx = node.getAttribute("context_child_idx");
    var children = this.substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);
	var name = getInternalName(node, path);	//the second part gives strings like CHO_, INT_ and so on.

    var blocklyCode = "";

    var validationConstraint = [];

    if(! node.hasAttribute("visited") ) {

            //each block created here will have a top notch. It may or may not have a bottom notch depending on nodeType
        var stagedSlotNumber= makeQueueIndexMacro(this.currentQueueIndex) + "." + this.localSlotNumber;
        var topListStr      = '["'+stagedSlotNumber+'"]';
        var wantBottomNotch = bottomNotchOverride || magicType[nodeType].hasBottomNotch;
        var bottomListStr   = wantBottomNotch ? topListStr : "[]";

        //Rule 1
        //if any magic node has another magic node as its only child, inline the child
        if(children.length == 1 && magicType.hasOwnProperty(children[0].nodeName)){
//
// *
// *    FIXME: Leo: I've commented out 3 lines in the following paragraph,
// *           to avoid showing extra unnamed nodes and extra indentation.
// *           However there seem to be some examples that do need this code.
// *           Let's find them and have another look at kitchen_nested_magic.rng example.
// *
//

//            blocklyCode = this.makeBlocklyCode_Label(name);
            var childPath = name + '0';
            node.setAttribute("visited", "true");
            var child = children[0];

//            this.uni.indent(true);
                //if current tag has bottom notch, propagate its bottom notch to children
            blocklyCode += this.handleMagicTag(child, haveAlreadySeenStr, childPath, wantBottomNotch, validationConstraint, nodeDetails);
//            this.uni.unindent();

        }else{
            if( magicType[nodeType].hasSeparateKids ) {     //current node is choice or interleave
                var childrenDisplayNames = [];
                for(var i=0;i<children.length;i++){
                    var currentChild = children[i];

                    if(magicType.hasOwnProperty(currentChild.nodeName)){    // interleave or choice has magic child
                        var childBottomListStr = ( wantBottomNotch || magicType[currentChild.nodeName].hasBottomNotch ) ? topListStr : "[]" ;
                        var currentContext = currentChild.getAttribute("context");
                        var childrenOfCurrentChild = this.substitutedNodeList(currentChild.childNodes, haveAlreadySeenStr, currentContext);

                        if(magicType[currentChild.nodeName].hasSeparateKids){   //choice/interleave has choice/interleave as a child
                            var arrayOfChildren = [];
                            var validationSubConstraint = [];
                            validationConstraint.push( [ currentChild.nodeName, validationSubConstraint ] );
                            for(var j=0; j<childrenOfCurrentChild.length; j++){
                                var childBlockName = this.getNodeDisplayNameOrQueueIndexMacro(childrenOfCurrentChild[j]);
                                childrenDisplayNames.push(childBlockName);
                                validationSubConstraint.push( [ "block", makeQueueIndexMacro(this._nextQueueIndex)] );
                                this.pushToQueue(childBlockName, [ childrenOfCurrentChild[j] ], topListStr, childBottomListStr);
                                arrayOfChildren.push(childBlockName);
                            }

                        } else {        //choice/interleave has a oneOrMore/zeroOrMore/optional child
                            var childBlockName = this.getNodeDisplayNameOrQueueIndexMacro(currentChild);
                            childrenDisplayNames.push(childBlockName);
                            validationConstraint.push( [ "block", makeQueueIndexMacro(this._nextQueueIndex) ] );
                            this.pushToQueue(childBlockName, childrenOfCurrentChild, topListStr, childBottomListStr);
                        }
                    } else {           //child of choice/interleave is a normal one
                        var childBlockName = this.getNodeDisplayNameOrQueueIndexMacro(currentChild);
                        childrenDisplayNames.push(childBlockName);
                        validationConstraint.push( [ "block", makeQueueIndexMacro(this._nextQueueIndex) ] );
                        this.pushToQueue(childBlockName, [currentChild], topListStr, bottomListStr);
                    }
                }
                var slotSignature = childrenDisplayNames.join(" " + magicType[node.nodeName].prettyIndicator + " ");
                node.setAttribute("slotSignature", slotSignature);
                blocklyCode = this.makeBlocklyCode_StatementInput(slotSignature, stagedSlotNumber, nodeDetails);

			} else {      //current node is oneOrMore, zeroOrMore, optional

                    var childBlockName = (children.length == 1)
                                            ? this.getNodeDisplayNameOrQueueIndexMacro(children[0])
                                            : makeSubstituteMacro(this._nextQueueIndex);

                    validationConstraint.push( [ "block", makeQueueIndexMacro(this._nextQueueIndex) ] );
                    this.pushToQueue(childBlockName, children, topListStr, bottomListStr);
                    var slotSignature = childBlockName + magicType[node.nodeName].prettyIndicator;
                    node.setAttribute("slotSignature", slotSignature);
                    blocklyCode = this.makeBlocklyCode_StatementInput(slotSignature, stagedSlotNumber, nodeDetails);
            }

            node.setAttribute("visited", "true");
            node.setAttribute("stagedSlotNumber", stagedSlotNumber);
        }
    } else if(magicType[nodeType].hasLoopRisk) {
			alert("circular ref loop detected because of "+node.nodeName);
            blocklyCode = this.makeBlocklyCode_UnindentedLabel("***Circular Reference***");
    } else {
            console.log(node.nodeName + " " + context + "_" + node.nodeName.substring(0,3) + context_child_idx + " has been visited already, skipping");

            var stagedSlotNumber = node.getAttribute("stagedSlotNumber");
            var slotSignature = node.getAttribute("slotSignature");
            blocklyCode = this.makeBlocklyCode_StatementInput(slotSignature, stagedSlotNumber, nodeDetails);
            validationConstraint.push( [ "block", makeQueueIndexMacro(this.currentQueueIndex) ] );
	}

    validationDetails.push( [ nodeType, validationConstraint ] );
	return blocklyCode;
}


function makeQueueIndexMacro(qi) {
    return "QUEUE_INDEX_"+qi+"_";
}

function makeSubstituteMacro(qi) {
    return "SUBSTITUTE_" + makeQueueIndexMacro(qi);
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


RNG2Blockly.prototype.getNodeDisplayName = function(node) {
    return ( node.getAttribute("blockly:blockName") || node.getAttribute("name") );
};

RNG2Blockly.prototype.getNodeDisplayNameOrQueueIndexMacro = function(node) {
    return ( this.getNodeDisplayName(node) || makeSubstituteMacro(this._nextQueueIndex) );
};

RNG2Blockly.prototype.getNodeDisplayNameOrDefaultLabel = function(node) {
    return ( this.getNodeDisplayName(node) || ("(unnamed " + node.nodeName + ")") );
};


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


function getInternalName(node, path){
    if(node == null){
        return null;
    }
    var nameAttribute = node.getAttribute("name");
    var name = path + node.nodeName.substring(0,3).toUpperCase();
    if(nameAttribute){
        name = name + "_" + nameAttribute;
    }
    return name;
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


function NodeDetails(tagName){
    this.tagName = tagName;
}


NodeDetails.prototype.appendContentAtChildLevel = function(tagName, internalName) {
    var nodeContent = [ { 'tagName' : tagName , 'internalName' : internalName } ];
    this.content = nodeContent;
    return;
};
