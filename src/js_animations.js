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


function scrollToWorkspace(){
	var workspaceYPos = document.getElementById("blocklyDiv").offsetTop;
	var btnYPos = document.getElementById("interpretBtn").offsetTop;
	var diff = workspaceYPos - btnYPos;
	var inc = diff/100;
	var animation = setInterval(function(){
		if(diff <= 0){
			clearInterval(animation);
		} else{
			window.scrollTo( 0 , workspaceYPos-diff+inc );	//we use workspaceYPos-diff instead of btnYPos because diff is updated in each iteration
			diff-=inc;
		}
	} , 8);		//8ms is chosen on the basis of trial and error. No mathematical reasons involved.
}


function scrollToTop(){
	var workspaceYPos = document.getElementById("blocklyDiv").offsetTop;
	var btnYPos = document.getElementById("interpretBtn").offsetTop;
	var diff = workspaceYPos - btnYPos;
	var dec = diff/100;
	var animation = setInterval(function(){
		if(diff <= 0){
			clearInterval(animation);
		} else{
			window.scrollTo( 0 , btnYPos+diff-dec );
			diff-=dec;
		}
	} , 8);
}
