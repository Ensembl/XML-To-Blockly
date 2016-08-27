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

    In this file we extend some Core Javascript API that seems to be missing at the time of writing.
 */


/**
 * A helper method to find an element in a list - returns a boolean.
 *
 * Note 1: it is based on the element, supplying a list, not the other way around.
 *
 * Note 2: it may pollute the namespace of Object class (not for-in safe!)
 */
    // a helper to find an element in a list
Object.prototype.isOneOf = function(list) {
    for(i=0;i<list.length;i++) {
        if(this == list[i]) {
            return true;
        }
    }
    return false;
};


/**
 * A helper method to get all the values of a hash
 *
 * Note 1: it may pollute the namespace of Object class (not for-in safe!)
 */
    // a helper to find an element in a list
Object.prototype.getAllValues = function() {
    return Object.keys(this).map( function(a) { return this[a]; }, this );
};


/**
 * Add missing elements of the second list into the first list.
 *
 * You have control of whether the merger happens in place, or you get a new list returned (via the second boolean parameter).
 */
Array.prototype.union = function(newComers, inPlace) {

    var list = inPlace ? this : [].concat(this);

    for(var i=0;i<newComers.length;i++) {
        if(list.indexOf(newComers[i])<0) {
            list.push(newComers[i]);
        }
    }

    return list;
}


/**
 * String comparison function useful in sort()
 *
 */
function string_cmp(a, b) {
    return (a < b)
            ? -1
            : (a > b)
                ? 1
                : 0;
}

