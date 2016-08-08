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

 * ***************************************************************************

    In this file we extend the standard Blockly library with application-specific functionality
    that seems to be core enough to become core extension.
 */


/**
 * Returns the list of all blocks currently inserted&chained into a slot specified by slotName.
 *
 * It is way easier to iterate this way (just one call, and you always get a list, even if empty).
 */
Blockly.Block.prototype.getSlotContentsList = function(slotName) {
    var slotContentsList = [];

    var next = this.getInputTargetBlock(slotName);

    while(next) {
        slotContentsList.push( blockNameToDisplayNameMapper[next.type] );
        next = next.getNextBlock();
    }
    /*
    var firstBlockInConnection = slotName.connection.targetBlock();
    if(firstBlockInConnection != null){
        slotContentsList.push( blockNameToDisplayNameMapper[firstBlockInConnection.type] );//push pretty name to list
        var nextConn = firstBlockInConnection.nextConnection;
        while(nextConn != null){
            if(nextConn.targetConnection == null){
                break;
            } else{
                var currentBlock = nextConn.targetConnection.sourceBlock_;
                slotContentsList.push( blockNameToDisplayNameMapper[currentBlock.type] );  //push pretty name to list
                nextConn = currentBlock.nextConnection;
            }
        }
    }*/

    return slotContentsList;
};
