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

function RNG2Blockly(rngDoc, blockStructureDict, validatorDict) {
    this.rngDoc = rngDoc;
    this.numberTypes = [ 'int' , 'integer' , 'double' , 'float' , 'decimal' , 'number' ];
    this.magicType = {
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

    var rootElement = rngDoc.documentElement;
    var startContent = (rootElement.nodeName == "grammar")
        ? rngDoc.getElementsByTagName("start")[0].childNodes
        : [ rootElement ];

    removeRedundantText(rootElement);
    removeXMLComments(rootElement);

    var codeDict            = new CodeDict(this);   // Structure to store non-redundant pieces of Bockly code
    this.blockRequestQueue  = [];   // a queue that holds requests to create new blocks

    this._nextQueueIndex = 0;
    this.pushToQueue("start", this.substitutedNodeList(startContent, "{}", "START"), "[]", "[]"); // initialize the queue
    this.uni = new UnicodeIndenter();

    this.errorBuffer = [];

    while(this.blockRequestQueue.length>0) {     // keep consuming from the head and pushing to the tail
        var blockRequest        = this.blockRequestQueue.shift();

        var children            = blockRequest.children;
        var blockDisplayName    = blockRequest.blockDisplayName;
        this.currentQueueIndex  = blockRequest.queueIndex;
        var blockCode           = "";   // Contains data sent by all the children merged together one after the other.

        this.localSlotNumber    = 1;    // base_1 is more convenient for eyeballing
        this.blockValidationDict = {}

        this.uni.reset();

        var xmlStructureForBlock = [];
        for(var i=0;i<children.length;i++){
            blockCode += this.goDeeper(children[i], "{}", i, xmlStructureForBlock);
        }
        //console.log(xmlStructureForBlock);

            // We want to always have a start block and here we force its blockCode to be unique
        if( this.currentQueueIndex == 0 ) {
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

        // blockCode may contain SUBSTITUTE_QUEUE_INDEX_ references to blocks that
        // have already been merged (because slotSignature is cached in the node)
        var mergedBlocks = codeDict.getAllEntries().filter( function(a) { return a.queueIndices.length > 1; } );
        if (mergedBlocks.length > 0) {
            var subst = {};
            for (var i=0; i<mergedBlocks.length; i++) {
                var b = mergedBlocks[i].queueIndices;
                for (var j=1; j<b.length; j++) {
                    subst[b[j]] = b[0];
                }
            }
            candidateDictEntry.blockCode = candidateDictEntry.blockCode.replace(/SUBSTITUTE_QUEUE_INDEX_(\d+)_/g, function replacer(match, $1) {
                return subst.hasOwnProperty($1) ? makeSubstituteMacro(subst[$1]) : match;
            } );
        }

        codeDict.mergeIfPossibleOtherwiseAdd(candidateDictEntry);
    }

    this.toolboxXML      = "";
    this.allCode         = [];
    this.hue             = new HueGenerator();

    var queueIndex_2_blockType          = {};   // Caution: this.queueIndex_2_blockType did not work in the replacer() callback
    var blockTypeToDisplayNameMapper    = {};

        // blockOrder contains entries of codeDict sorted by the youngest queueIndex
    var blockOrder = codeDict.getAllEntries().sort( function(a,b) { return string_cmp(a.queueIndices[0],b.queueIndices[0]); } );

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
                    + "},"
                    + "};";

        blockCode = blockCode.replace(/SUBSTITUTE_QUEUE_INDEX_(\d+)_/g, function replacer(match, $1) {
            var blockType   = queueIndex_2_blockType[$1];
            var displayName = blockTypeToDisplayNameMapper[blockType];
            return (displayName && !displayName.match(/SUBSTITUTE_QUEUE_INDEX_/)) ? displayName : blockType;
        } );

        var blockValidationDict = JSON.parse(dictEntry.blockValidationDict.replace(/SUBSTITUTE_QUEUE_INDEX_(\d+)_/g, function replacer(match, $1) {
            return queueIndex_2_blockType[$1];
        } ));
        validatorDict[blockType] = {};
        var slotNames = Object.keys(blockValidationDict);
        for(var i=0; i<slotNames.length; i++) {
            var slotName = slotNames[i];
            validatorDict[blockType][slotName] = new Validator(blockValidationDict[slotName]);
        }

        blockCode = blockCode.replace(/\n{2,}/g, "\n");
        this.allCode.push(blockCode);
    }
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
    return getAllValues( this._codeDict );
}

    // attempt to merge the candidate
CodeDict.prototype.mergeIfPossibleOtherwiseAdd = function(candidateDictEntry) {

    var candidateQueueIndex         = candidateDictEntry.queueIndices[0];   // only the youngest (CHECKME: is this right?)
    var candidateQueueIndexMacro    = makeQueueIndexMacro( candidateQueueIndex );

    if (this.containsEntry(candidateDictEntry)) {   // if we have created such a block already, just merge the compatibility lists
        var foundEntry              = this.getEntry(candidateDictEntry);
        var foundQueueIndex         = foundEntry.queueIndices[0];
        var foundQueueIndexMacro    = makeQueueIndexMacro( foundQueueIndex );
        var regexp                  = new RegExp(candidateQueueIndexMacro, "g");    // used RegExp to benefit from /g

        foundEntry.topList.union(      candidateDictEntry.topList, true );
        foundEntry.bottomList.union(   candidateDictEntry.bottomList, true );
        foundEntry.queueIndices.union( [candidateQueueIndex], true );

        console.log("Recognition: when attempting to create block "+candidateQueueIndexMacro+" recognized it as "+foundQueueIndexMacro);

            var blocksToAdd = [];

            // Find and remove the blocks that have to be substituted
            var blockReverseOrder = this.getAllEntries().sort( function(a,b) { return string_cmp(b.queueIndices[0],a.queueIndices[0]); } );
            for(var i=0; i<blockReverseOrder.length; i++) {     // go through already generated blocks
                var generatedBlockCode = blockReverseOrder[i];

                if(generatedBlockCode.blockCode.indexOf(candidateQueueIndexMacro) > -1) {     // does it mention our newly recognized friend?
                        // detach the matched entry
                    var stashedDictEntry = generatedBlockCode;
                    this.deleteEntry(generatedBlockCode);

                        // update the code of the matched entry
                    stashedDictEntry.blockCode  = generatedBlockCode.blockCode.replace(regexp, foundQueueIndexMacro);

                    // We don't add the entry immediately because that may updated some entries that we have in blockReverseOrder
                    blocksToAdd.push(stashedDictEntry);
                }
            }

            // Add their new versions 1 by 1
            for(var i=0; i<blocksToAdd.length; i++) {
                this.mergeIfPossibleOtherwiseAdd(blocksToAdd[i]);
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
                var errorMsg = "A definition loop detected in the RNG ("+nodeName+"), therefore the corresponding system of Blocks is not constructable";
                alert( errorMsg );
                this.errorBuffer.push( errorMsg );
                return [];

            } else {
                currChildHasSeen[nodeName] = true;
                var defKids = findOneNodeByTagAndName(this.rngDoc, "define", nodeName).childNodes;

                var substKids = this.substitutedNodeList(defKids, JSON.stringify(currChildHasSeen), nodeName);
                Array.prototype.push.apply( substChildren, substKids);
            }
        } else {
            currChild.setAttribute("context", substContext);                                // magic tags will use this to propagate the context

            if( this.magicType.hasOwnProperty(currChild.nodeName) ) {      // testing if currChild is magic in general
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

    var nodeType    = node.nodeName;
    var context     = node.getAttribute("context");
    var name        = getInternalName(node, path);
    var nodeDetails = new NodeDetails(nodeType);    // internalName, xmlName and content are added later
    var addNodeDetailsToStructure = true;

	var blocklyCode = ""; // Contains data sent by all the children merged together one after the other.


	if(nodeType == "text") {
        nodeDetails.internalName = name;

        var displayName = this.getNodeDisplayNameOrDefaultLabel(node);

        blocklyCode += this.makeBlocklyCode_TextField(displayName, name);

    }

    else if ((nodeType == "element") || (nodeType == "attribute")) {

        nodeDetails.xmlName = node.getAttribute("name");

        if(! nodeDetails.xmlName) {
            var errorMsg = "An "+nodeType+" has no name! Substituting with NONAME";
            alert( errorMsg );
            this.errorBuffer.push( errorMsg );
            nodeDetails.xmlName = 'NONAME';
        }

        haveAlreadySeenStr = node.getAttribute("haveAlreadySeen");
        var children = this.substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);
        var allValueTags = "";
        var displayName = this.getNodeDisplayNameOrDefaultLabel(node);

        if( children.length == 0 ){

            if (nodeType == "element") {
                blocklyCode = this.makeBlocklyCode_Label(displayName);
                nodeDetails.content = [];
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
            var typeChecker = isOneOf( this.numberTypes , (type||'') ) ? "Blockly.FieldTextInput.numberValidator" : "null";

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
            blocklyCode = this.makeBlocklyCode_Label(displayName)
                        + this.goDeeper_makeTreeWithKids(children, haveAlreadySeenStr, name, childrenStructureInfo);
            if(currentPathStructure){   //since we have not introduced currentPathStructure in all goDeeper calls yet
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
            blocklyCode = this.makeBlocklyCode_Label(displayName)
                        + this.goDeeper_makeTreeWithKids(children, haveAlreadySeenStr, name, currentPathStructure);
        } else {
            blocklyCode = this.goDeeper_iterateOverKids(children, haveAlreadySeenStr, name, currentPathStructure);
        }
    }

	else if(nodeType == "optional"){

            // check if the user has requested/blocked an optiField for this optional:
        var wantOptiFieldStr = node.getAttribute("blockly:inline") || node.getAttribute("blockly:wantOptiField");
        var wantOptiField = wantOptiFieldStr ? (wantOptiFieldStr == "true") : true; // inline optionals by default

        if( wantOptiField ) {
            var childrenStructureInfo = [];
            var children = this.substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);
            var oneLiner = children.length == 1 && !this.magicType.hasOwnProperty(children[0].nodeName);

            nodeDetails.tagName = "optiField";
            nodeDetails.internalName = name + "_checkbox";
            nodeDetails.content = childrenStructureInfo;

                //if optiField consists of only one child level, then we do not create a label for the optiField specifically:
            if ( oneLiner ) {
                var preOptiFieldCode = this.goDeeper_iterateOverKids(children, haveAlreadySeenStr, name, childrenStructureInfo);

                // FIXME: we shouldn't have to split the Blockly code
                var first = preOptiFieldCode.indexOf('.appendField(');
                var second = preOptiFieldCode.indexOf('.appendField(', first+1); // to skip the first one
                var childPartToBeAdded = preOptiFieldCode.substring(second);
                blocklyCode = this.makeBlocklyCode_OptiField("", name, childPartToBeAdded);
            } else{
                var preOptiFieldCode = this.goDeeper_makeTreeWithKids(children, haveAlreadySeenStr, name, childrenStructureInfo);

                var displayName = this.getNodeDisplayNameOrDefaultLabel(node);
                blocklyCode = this.makeBlocklyCode_OptiField(displayName, name, preOptiFieldCode);
            }

        } else{
            nodeDetails.tagName = "slot";
            var tagValidationRuleContainer = [];    // an extra returned value: container is passed in, the first pushed element is returned back
            blocklyCode = this.handleMagicTag(node, haveAlreadySeenStr, path, false, tagValidationRuleContainer, nodeDetails, true);
            this.blockValidationDict[nodeDetails.internalName] = tagValidationRuleContainer.pop();
        }
	}

    else if (this.magicType.hasOwnProperty(nodeType)) {      // interleave, zeroOrMore, oneOrMore, and some choice
        nodeDetails.tagName = "slot";
        var tagValidationRuleContainer = [];        // an extra returned value: container is passed in, the first pushed element is returned back
        blocklyCode = this.handleMagicTag(node, haveAlreadySeenStr, path, false, tagValidationRuleContainer, nodeDetails, true);
        this.blockValidationDict[nodeDetails.internalName] = tagValidationRuleContainer.pop();
	}

    else {
        blocklyCode = this.makeBlocklyCode_Label("unhandled \"" + nodeType + "\" tag");
    }

    if(addNodeDetailsToStructure){
        currentPathStructure.push(nodeDetails);
    }
    return blocklyCode + "\n";
}

RNG2Blockly.prototype.goDeeper_makeTreeWithKids = function(children, haveAlreadySeenStr, path, currentPathStructure) {
    var blocklyCode = "";
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

RNG2Blockly.prototype.makeBlocklyCode_OptiField = function(label, internalName, content) {
    var checkBoxName    = internalName + "_checkbox";
    var initialState    = false;
    var code = "this.appendDummyInput('" + internalName + "')"
                 + ".appendField('" + this.uni.getIndentation() + "?')"
                 + ".appendField(new Blockly.FieldCheckbox('" + String(initialState).toUpperCase() + "', optiField_setter), '" + checkBoxName + "')"
                 + ( (label != "") ? ".appendField('" + label + "');\n" : "")
                 + content  // the assumption here is that content is terminated by a semicolon
                 + "this.appendDummyInput('" + internalName + "end_of_optiField').setVisible(false);\n"     // this hidden input line marks the end of optiField group
                 + "optiField_setter.call( this.getField('" + checkBoxName + "'), " + initialState + ");"; // actually set the initialState

    return code;
};

RNG2Blockly.prototype.makeBlocklyCode_StatementInput = function(slotSignature, slotRuleToMatchWithIncomingNotch, nodeDetails) {
    var internalSlotName = 'slot_' + this.localSlotNumber++;
    nodeDetails.internalName = internalSlotName;
    return "this.appendStatementInput('" + internalSlotName + "').setCheck(['" + slotRuleToMatchWithIncomingNotch + "']).appendField('" + this.uni.getIndentation() + "').appendField('" + slotSignature + "');";
};



    //creates a notch in its parent block with a label for the magic block that has called it. Then creates a separate block for every child.
RNG2Blockly.prototype.handleMagicTag = function(node, haveAlreadySeenStr, path, bottomNotchOverride, tagValidationRuleContainer, nodeDetails, canCreateInputStatements){
    var nodeType = node.nodeName;
	var context = node.getAttribute("context");
    var context_child_idx = node.getAttribute("context_child_idx");
    var children = this.substitutedNodeList(node.childNodes, haveAlreadySeenStr, context);
	var name = getInternalName(node, path);	//the second part gives strings like CHO_, INT_ and so on.

    var blocklyCode = "";

    var childValidationRules    = [];
    var tagValidationRule       = [ nodeType, childValidationRules, this.getNodeDisplayName(node) ];

    var stagedSlotNumber;

    if( node.hasAttribute("visiting_lock") ) {                                      // visiting in progress:
        if( this.magicType[nodeType].hasLoopRisk ) {
            var errorMsg = "circular ref loop detected because of "+node.nodeName;
            alert( errorMsg );
            this.errorBuffer.push( errorMsg );

            blocklyCode = this.makeBlocklyCode_UnindentedLabel("***Circular Reference***");
        } else {
            stagedSlotNumber= makeQueueIndexMacro(this.currentQueueIndex) + "." + this.localSlotNumber;
            var topListStr      = '["'+stagedSlotNumber+'"]';
            var wantBottomNotch = bottomNotchOverride || this.magicType[nodeType].hasBottomNotch;
            var bottomListStr   = wantBottomNotch ? topListStr : "[]";

            if( this.magicType[nodeType].hasSeparateKids ) {     //current node is choice or interleave
                for(var i=0;i<children.length;i++){
                    var currentChild = children[i];

                    var childBlockName = this.getNodeDisplayNameOrQueueIndexMacro(currentChild);
                    childValidationRules.push( [ "block", makeSubstituteMacro(this._nextQueueIndex) ] );
                    this.pushToQueue(childBlockName, [currentChild], topListStr, bottomListStr);
                }
            } else {
                var childBlockName = this.getNodeDisplayNameOrQueueIndexMacro(children.length == 1 ? children[0] : node);
                childValidationRules.push( [ "block", makeSubstituteMacro(this._nextQueueIndex) ] );
                this.pushToQueue(childBlockName, children, topListStr, bottomListStr);
            }
        }

    } else if( canCreateInputStatements && (stagedSlotNumber = node.getAttribute("stagedSlotNumber")) ) { // such a slot and set of child blocks has been requested previously, reuse

        var slotSignature = node.getAttribute("slotSignature");
        var slotValidationRules = node.getAttribute("slotValidationRules");

        blocklyCode = this.makeBlocklyCode_StatementInput(slotSignature, stagedSlotNumber, nodeDetails);
        //childValidationRules.push( JSON.parse(slotValidationRules) );
        tagValidationRule   = JSON.parse(slotValidationRules);  // Matthieu, isn't this more correct than the above?

    } else {                                                                        // never visited before:

        stagedSlotNumber= makeQueueIndexMacro(this.currentQueueIndex) + "." + this.localSlotNumber;

            //each block created here will have a top notch. It may or may not have a bottom notch depending on nodeType
        var topListStr      = '["'+stagedSlotNumber+'"]';
        var wantBottomNotch = bottomNotchOverride || this.magicType[nodeType].hasBottomNotch;
        var bottomListStr   = wantBottomNotch ? topListStr : "[]";

            node.setAttribute("visiting_lock", "true");

            if( this.magicType[nodeType].hasSeparateKids ) {     //current node is choice or interleave
                for(var i=0;i<children.length;i++){
                    var currentChild = children[i];

                    if(this.magicType.hasOwnProperty(currentChild.nodeName)){
                        blocklyCode += this.handleMagicTag(currentChild, haveAlreadySeenStr, name + i, wantBottomNotch, childValidationRules, nodeDetails, false);

                    } else {
                        var childBlockName = this.getNodeDisplayNameOrQueueIndexMacro(currentChild);
                        childValidationRules.push( [ "block", makeSubstituteMacro(this._nextQueueIndex) ] );
                        this.pushToQueue(childBlockName, [currentChild], topListStr, bottomListStr);
                    }
                }

			} else {      //current node is oneOrMore, zeroOrMore, optional

                if (children.length == 1 && this.magicType.hasOwnProperty(children[0].nodeName)) {
                    blocklyCode = this.handleMagicTag(children[0], haveAlreadySeenStr, name + "0", wantBottomNotch, childValidationRules, nodeDetails, false);

                } else {
                    var childBlockName = this.getNodeDisplayNameOrQueueIndexMacro(children.length == 1 ? children[0] : node);
                    childValidationRules.push( [ "block", makeSubstituteMacro(this._nextQueueIndex) ] );
                    this.pushToQueue(childBlockName, children, topListStr, bottomListStr);
                }
            }

            if (canCreateInputStatements) {     // only the outermost nested magic tag will produce a slot and record it
                var slotSignature = this.slotLabelFromValidationRules( tagValidationRule );
                node.setAttribute("stagedSlotNumber", stagedSlotNumber);
                node.setAttribute("slotSignature", slotSignature);
                node.setAttribute("slotValidationRules", JSON.stringify( tagValidationRule ) );

                blocklyCode += this.makeBlocklyCode_StatementInput(slotSignature, stagedSlotNumber, nodeDetails);
            }

            node.removeAttribute("visiting_lock");
	}

    tagValidationRuleContainer.push( tagValidationRule );   // another value is returned from this function via pushing into a container list
	return blocklyCode;
}


function makeQueueIndexMacro(qi) {
    return "QUEUE_INDEX_"+qi+"_";
}

function makeSubstituteMacro(qi) {
    return "SUBSTITUTE_" + makeQueueIndexMacro(qi);
}


// Recursive method that returns a pretty name for the given Validation
// rule, since it happens to be exactly the structure we need
RNG2Blockly.prototype.slotLabelFromValidationRules = function(g) {
    if (g[2]) {
        return g[2] + ((g[0] == 'optional') ? "?" : "");
    }
    if (g[0] == "block") {
        return g[1];
    } else if( this.magicType[g[0]].hasSeparateKids ) {
        var kidLabels = g[1].map( function(x) {return x[0]=="block" ? x[1] : ("(" + this.slotLabelFromValidationRules(x) + ")");}, this );
        return kidLabels.join(" " + this.magicType[g[0]].prettyIndicator + " ");
    } else {
        var childRule = g[1][0];
        return (childRule[0] == "block" ? childRule[1] : ("(" + this.slotLabelFromValidationRules(childRule) + ")")) + this.magicType[g[0]].prettyIndicator;
    }
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
    this.content = [ { 'tagName' : tagName , 'internalName' : internalName } ];
}
