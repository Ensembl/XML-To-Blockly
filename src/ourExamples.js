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

function exampleContact(){
	var file='<?xml version="1.0" encoding="UTF-8"?>\n'
            +'<grammar xmlns="http://relaxng.org/ns/structure/1.0" ns="test_data">\n'
            +'\t<start>\n'
            +'\t\t<element name="contact">\n'
            +'\t\t\t<element name="name">\n'
            +'\t\t\t\t<text/>\n'
            +'\t\t\t</element>\n'
            +'\t\t\t<element name="phone_number">\n'
            +'\t\t\t\t<text/>\n'
            +'\t\t\t</element>\n'
            +'\t\t\t<element name="email">\n'
            +'\t\t\t\t<element name="username">\n'
            +'\t\t\t\t\t<text/>\n'
            +'\t\t\t\t</element>\n'
            +'\t\t\t\t<element name="hostname">\n'
            +'\t\t\t\t\t<text/>\n'
            +'\t\t\t\t</element>\n'
            +'\t\t\t</element>\n'
            +'\t\t</element>\n'
            +'\t</start>\n'
            +'</grammar>';

    uploadFileAndSwitchTab(file);
}

function uploadFileAndSwitchTab(file){
    document.getElementById('file-name').innerHTML = "";
    document.getElementById('rng_area').value = file;
    document.querySelector('a[href^="#editor"]').click();
}
