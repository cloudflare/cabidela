"use strict";exports["#/definitions/allOfTwo"] = validate14;const schema16 = {"type":"object","allOf":[{"properties":{"string":{"type":"string"}}},{"properties":{"number":{"type":"number"}}}],"$id":"#/definitions/allOfTwo"};function validate14(data, {instancePath="", parentData, parentDataProperty, rootData=data}={}){/*# sourceURL="#/definitions/allOfTwo" */;let vErrors = null;let errors = 0;if(!(data && typeof data == "object" && !Array.isArray(data))){const err0 = {instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err0];}else {vErrors.push(err0);}errors++;}if(data && typeof data == "object" && !Array.isArray(data)){if(data.string !== undefined){if(typeof data.string !== "string"){const err1 = {instancePath:instancePath+"/string",schemaPath:"#/allOf/0/properties/string/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err1];}else {vErrors.push(err1);}errors++;}}}if(data && typeof data == "object" && !Array.isArray(data)){if(data.number !== undefined){let data1 = data.number;if(!((typeof data1 == "number") && (isFinite(data1)))){const err2 = {instancePath:instancePath+"/number",schemaPath:"#/allOf/1/properties/number/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err2];}else {vErrors.push(err2);}errors++;}}}validate14.errors = vErrors;return errors === 0;}exports["#/definitions/anyOfTwo"] = validate15;const schema17 = {"anyOf":[{"type":"string","maxLength":5},{"type":"number","minimum":0}],"$id":"#/definitions/anyOfTwo"};const func2 = function ucs2length(str) { const len = str.length; let length = 0; let pos = 0; let value; while (pos < len) { length++; value = str.charCodeAt(pos++); if (value >= 0xd800 && value <= 0xdbff && pos < len) { value = str.charCodeAt(pos); if ((value & 0xfc00) === 0xdc00) pos++; } } return length; };function validate15(data, {instancePath="", parentData, parentDataProperty, rootData=data}={}){/*# sourceURL="#/definitions/anyOfTwo" */;let vErrors = null;let errors = 0;const _errs0 = errors;let valid0 = false;const _errs1 = errors;if(typeof data === "string"){if(func2(data) > 5){const err0 = {instancePath,schemaPath:"#/anyOf/0/maxLength",keyword:"maxLength",params:{limit: 5},message:"must NOT have more than 5 characters"};if(vErrors === null){vErrors = [err0];}else {vErrors.push(err0);}errors++;}}else {const err1 = {instancePath,schemaPath:"#/anyOf/0/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err1];}else {vErrors.push(err1);}errors++;}var _valid0 = _errs1 === errors;valid0 = valid0 || _valid0;if(!valid0){const _errs3 = errors;if((typeof data == "number") && (isFinite(data))){if(data < 0 || isNaN(data)){const err2 = {instancePath,schemaPath:"#/anyOf/1/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};if(vErrors === null){vErrors = [err2];}else {vErrors.push(err2);}errors++;}}else {const err3 = {instancePath,schemaPath:"#/anyOf/1/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err3];}else {vErrors.push(err3);}errors++;}var _valid0 = _errs3 === errors;valid0 = valid0 || _valid0;}if(!valid0){const err4 = {instancePath,schemaPath:"#/anyOf",keyword:"anyOf",params:{},message:"must match a schema in anyOf"};if(vErrors === null){vErrors = [err4];}else {vErrors.push(err4);}errors++;}else {errors = _errs0;if(vErrors !== null){if(_errs0){vErrors.length = _errs0;}else {vErrors = null;}}}validate15.errors = vErrors;return errors === 0;}exports["#/definitions/oneOfTwo"] = validate16;const schema18 = {"oneOf":[{"type":"number","multipleOf":5},{"type":"number","multipleOf":3}],"$id":"#/definitions/oneOfTwo"};function validate16(data, {instancePath="", parentData, parentDataProperty, rootData=data}={}){/*# sourceURL="#/definitions/oneOfTwo" */;let vErrors = null;let errors = 0;const _errs0 = errors;let valid0 = false;let passing0 = null;const _errs1 = errors;if((typeof data == "number") && (isFinite(data))){let res0;if((5 === 0 || (res0 = data/5, res0 !== parseInt(res0)))){const err0 = {instancePath,schemaPath:"#/oneOf/0/multipleOf",keyword:"multipleOf",params:{multipleOf: 5},message:"must be multiple of 5"};if(vErrors === null){vErrors = [err0];}else {vErrors.push(err0);}errors++;}}else {const err1 = {instancePath,schemaPath:"#/oneOf/0/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err1];}else {vErrors.push(err1);}errors++;}var _valid0 = _errs1 === errors;if(_valid0){valid0 = true;passing0 = 0;}const _errs3 = errors;if((typeof data == "number") && (isFinite(data))){let res1;if((3 === 0 || (res1 = data/3, res1 !== parseInt(res1)))){const err2 = {instancePath,schemaPath:"#/oneOf/1/multipleOf",keyword:"multipleOf",params:{multipleOf: 3},message:"must be multiple of 3"};if(vErrors === null){vErrors = [err2];}else {vErrors.push(err2);}errors++;}}else {const err3 = {instancePath,schemaPath:"#/oneOf/1/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err3];}else {vErrors.push(err3);}errors++;}var _valid0 = _errs3 === errors;if(_valid0 && valid0){valid0 = false;passing0 = [passing0, 1];}else {if(_valid0){valid0 = true;passing0 = 1;}}if(!valid0){const err4 = {instancePath,schemaPath:"#/oneOf",keyword:"oneOf",params:{passingSchemas: passing0},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err4];}else {vErrors.push(err4);}errors++;}else {errors = _errs0;if(vErrors !== null){if(_errs0){vErrors.length = _errs0;}else {vErrors = null;}}}validate16.errors = vErrors;return errors === 0;}exports["#/definitions/imageSchema"] = validate17;const schema19 = {"type":"object","properties":{"image":{"type":"array","items":{"type":"number"}}},"required":["image"],"$id":"#/definitions/imageSchema"};function validate17(data, {instancePath="", parentData, parentDataProperty, rootData=data}={}){/*# sourceURL="#/definitions/imageSchema" */;let vErrors = null;let errors = 0;if(data && typeof data == "object" && !Array.isArray(data)){if(data.image === undefined){const err0 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "image"},message:"must have required property '"+"image"+"'"};if(vErrors === null){vErrors = [err0];}else {vErrors.push(err0);}errors++;}if(data.image !== undefined){let data0 = data.image;if(Array.isArray(data0)){const len0 = data0.length;for(let i0=0; i0<len0; i0++){let data1 = data0[i0];if(!((typeof data1 == "number") && (isFinite(data1)))){const err1 = {instancePath:instancePath+"/image/" + i0,schemaPath:"#/properties/image/items/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err1];}else {vErrors.push(err1);}errors++;}}}else {const err2 = {instancePath:instancePath+"/image",schemaPath:"#/properties/image/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err2];}else {vErrors.push(err2);}errors++;}}}else {const err3 = {instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err3];}else {vErrors.push(err3);}errors++;}validate17.errors = vErrors;return errors === 0;}exports["#/definitions/twoLevelImageSchema"] = validate18;const schema20 = {"type":"object","properties":{"child":{"type":"object","properties":{"image":{"type":"array","items":{"type":"number"}}},"required":["image"]}},"$id":"#/definitions/twoLevelImageSchema"};function validate18(data, {instancePath="", parentData, parentDataProperty, rootData=data}={}){/*# sourceURL="#/definitions/twoLevelImageSchema" */;let vErrors = null;let errors = 0;if(data && typeof data == "object" && !Array.isArray(data)){if(data.child !== undefined){let data0 = data.child;if(data0 && typeof data0 == "object" && !Array.isArray(data0)){if(data0.image === undefined){const err0 = {instancePath:instancePath+"/child",schemaPath:"#/properties/child/required",keyword:"required",params:{missingProperty: "image"},message:"must have required property '"+"image"+"'"};if(vErrors === null){vErrors = [err0];}else {vErrors.push(err0);}errors++;}if(data0.image !== undefined){let data1 = data0.image;if(Array.isArray(data1)){const len0 = data1.length;for(let i0=0; i0<len0; i0++){let data2 = data1[i0];if(!((typeof data2 == "number") && (isFinite(data2)))){const err1 = {instancePath:instancePath+"/child/image/" + i0,schemaPath:"#/properties/child/properties/image/items/type",keyword:"type",params:{type: "number"},message:"must be number"};if(vErrors === null){vErrors = [err1];}else {vErrors.push(err1);}errors++;}}}else {const err2 = {instancePath:instancePath+"/child/image",schemaPath:"#/properties/child/properties/image/type",keyword:"type",params:{type: "array"},message:"must be array"};if(vErrors === null){vErrors = [err2];}else {vErrors.push(err2);}errors++;}}}else {const err3 = {instancePath:instancePath+"/child",schemaPath:"#/properties/child/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err3];}else {vErrors.push(err3);}errors++;}}}else {const err4 = {instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err4];}else {vErrors.push(err4);}errors++;}validate18.errors = vErrors;return errors === 0;}exports["#/definitions/allOfSimple"] = validate19;const schema21 = {"allOf":[{"type":"string"},{"maxLength":5}],"$id":"#/definitions/allOfSimple"};function validate19(data, {instancePath="", parentData, parentDataProperty, rootData=data}={}){/*# sourceURL="#/definitions/allOfSimple" */;let vErrors = null;let errors = 0;if(typeof data !== "string"){const err0 = {instancePath,schemaPath:"#/allOf/0/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err0];}else {vErrors.push(err0);}errors++;}if(typeof data === "string"){if(func2(data) > 5){const err1 = {instancePath,schemaPath:"#/allOf/1/maxLength",keyword:"maxLength",params:{limit: 5},message:"must NOT have more than 5 characters"};if(vErrors === null){vErrors = [err1];}else {vErrors.push(err1);}errors++;}}validate19.errors = vErrors;return errors === 0;}