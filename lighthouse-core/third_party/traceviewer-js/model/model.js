"use strict";require("../base/base.js");require("../base/event.js");require("../base/interval_tree.js");require("../base/quad.js");require("../base/range.js");require("../base/task.js");require("../base/time_display_modes.js");require("../base/unit.js");require("../core/auditor.js");require("../core/filter.js");require("./alert.js");require("./clock_sync_manager.js");require("./constants.js");require("./device.js");require("./flow_event.js");require("./frame.js");require("./global_memory_dump.js");require("./instant_event.js");require("./kernel.js");require("./model_indices.js");require("./model_stats.js");require("./object_snapshot.js");require("./process.js");require("./process_memory_dump.js");require("./sample.js");require("./stack_frame.js");require("./user_model/user_expectation.js");require("./user_model/user_model.js");'use strict';global.tr.exportTo('tr',function(){var Process=tr.model.Process;var Device=tr.model.Device;var Kernel=tr.model.Kernel;var GlobalMemoryDump=tr.model.GlobalMemoryDump;var GlobalInstantEvent=tr.model.GlobalInstantEvent;var FlowEvent=tr.model.FlowEvent;var Alert=tr.model.Alert;var Sample=tr.model.Sample;function Model(){tr.model.EventContainer.call(this);tr.b.EventTarget.decorate(this);this.timestampShiftToZeroAmount_=0;this.faviconHue='blue';this.device=new Device(this);this.kernel=new Kernel(this);this.processes={};this.metadata=[];this.categories=[];this.instantEvents=[];this.flowEvents=[];this.clockSyncManager=new tr.model.ClockSyncManager();this.intrinsicTimeUnit_=undefined;this.stackFrames={};this.samples=[];this.alerts=[];this.userModel=new tr.model.um.UserModel(this);this.flowIntervalTree=new tr.b.IntervalTree(f=>f.start,f=>f.end);this.globalMemoryDumps=[];this.userFriendlyCategoryDrivers_=[];this.annotationsByGuid_={};this.modelIndices=undefined;this.stats=new tr.model.ModelStats();this.importWarnings_=[];this.reportedImportWarnings_={};this.isTimeHighResolution_=true;this.patchupsToApply_=[];this.doesHelperGUIDSupportThisModel_={};this.helpersByConstructorGUID_={};this.eventsByStableId_=undefined;}Model.prototype={__proto__:tr.model.EventContainer.prototype,getEventByStableId:function(stableId){if(this.eventsByStableId_===undefined){this.eventsByStableId_={};for(var event of this.getDescendantEvents()){this.eventsByStableId_[event.stableId]=event;}}return this.eventsByStableId_[stableId];},getOrCreateHelper:function(constructor){if(!constructor.guid)throw new Error('Helper constructors must have GUIDs');if(this.helpersByConstructorGUID_[constructor.guid]===undefined){if(this.doesHelperGUIDSupportThisModel_[constructor.guid]===undefined){this.doesHelperGUIDSupportThisModel_[constructor.guid]=constructor.supportsModel(this);}if(!this.doesHelperGUIDSupportThisModel_[constructor.guid])return undefined;this.helpersByConstructorGUID_[constructor.guid]=new constructor(this);}return this.helpersByConstructorGUID_[constructor.guid];},childEvents:function*(){yield*this.globalMemoryDumps;yield*this.instantEvents;yield*this.flowEvents;yield*this.alerts;yield*this.samples;},childEventContainers:function*(){yield this.userModel;yield this.device;yield this.kernel;yield*tr.b.dictionaryValues(this.processes);},iterateAllPersistableObjects:function(callback){this.kernel.iterateAllPersistableObjects(callback);for(var pid in this.processes)this.processes[pid].iterateAllPersistableObjects(callback);},updateBounds:function(){this.bounds.reset();var bounds=this.bounds;for(var ec of this.childEventContainers()){ec.updateBounds();bounds.addRange(ec.bounds);}for(var event of this.childEvents())event.addBoundsToRange(bounds);},shiftWorldToZero:function(){var shiftAmount=-this.bounds.min;this.timestampShiftToZeroAmount_=shiftAmount;for(var ec of this.childEventContainers())ec.shiftTimestampsForward(shiftAmount);for(var event of this.childEvents())event.start+=shiftAmount;this.updateBounds();},convertTimestampToModelTime:function(sourceClockDomainName,ts){if(sourceClockDomainName!=='traceEventClock')throw new Error('Only traceEventClock is supported.');return tr.b.Unit.timestampFromUs(ts)+this.timestampShiftToZeroAmount_;},get numProcesses(){var n=0;for(var p in this.processes)n++;return n;},getProcess:function(pid){return this.processes[pid];},getOrCreateProcess:function(pid){if(!this.processes[pid])this.processes[pid]=new Process(this,pid);return this.processes[pid];},addStackFrame:function(stackFrame){if(this.stackFrames[stackFrame.id])throw new Error('Stack frame already exists');this.stackFrames[stackFrame.id]=stackFrame;return stackFrame;},updateCategories_:function(){var categoriesDict={};this.userModel.addCategoriesToDict(categoriesDict);this.device.addCategoriesToDict(categoriesDict);this.kernel.addCategoriesToDict(categoriesDict);for(var pid in this.processes)this.processes[pid].addCategoriesToDict(categoriesDict);this.categories=[];for(var category in categoriesDict)if(category!='')this.categories.push(category);},getAllThreads:function(){var threads=[];for(var tid in this.kernel.threads){threads.push(process.threads[tid]);}for(var pid in this.processes){var process=this.processes[pid];for(var tid in process.threads){threads.push(process.threads[tid]);}}return threads;},getAllProcesses:function(opt_predicate){var processes=[];for(var pid in this.processes){var process=this.processes[pid];if(opt_predicate===undefined||opt_predicate(process))processes.push(process);}return processes;},getAllCounters:function(){var counters=[];counters.push.apply(counters,tr.b.dictionaryValues(this.device.counters));counters.push.apply(counters,tr.b.dictionaryValues(this.kernel.counters));for(var pid in this.processes){var process=this.processes[pid];for(var tid in process.counters){counters.push(process.counters[tid]);}}return counters;},getAnnotationByGUID:function(guid){return this.annotationsByGuid_[guid];},addAnnotation:function(annotation){if(!annotation.guid)throw new Error('Annotation with undefined guid given');this.annotationsByGuid_[annotation.guid]=annotation;tr.b.dispatchSimpleEvent(this,'annotationChange');},removeAnnotation:function(annotation){this.annotationsByGuid_[annotation.guid].onRemove();delete this.annotationsByGuid_[annotation.guid];tr.b.dispatchSimpleEvent(this,'annotationChange');},getAllAnnotations:function(){return tr.b.dictionaryValues(this.annotationsByGuid_);},addUserFriendlyCategoryDriver:function(ufcd){this.userFriendlyCategoryDrivers_.push(ufcd);},getUserFriendlyCategoryFromEvent:function(event){for(var i=0;i<this.userFriendlyCategoryDrivers_.length;i++){var ufc=this.userFriendlyCategoryDrivers_[i].fromEvent(event);if(ufc!==undefined)return ufc;}return undefined;},findAllThreadsNamed:function(name){var namedThreads=[];namedThreads.push.apply(namedThreads,this.kernel.findAllThreadsNamed(name));for(var pid in this.processes){namedThreads.push.apply(namedThreads,this.processes[pid].findAllThreadsNamed(name));}return namedThreads;},get importOptions(){return this.importOptions_;},set importOptions(options){this.importOptions_=options;},get intrinsicTimeUnit(){if(this.intrinsicTimeUnit_===undefined)return tr.b.TimeDisplayModes.ms;return this.intrinsicTimeUnit_;},set intrinsicTimeUnit(value){if(this.intrinsicTimeUnit_===value)return;if(this.intrinsicTimeUnit_!==undefined)throw new Error('Intrinsic time unit already set');this.intrinsicTimeUnit_=value;},get isTimeHighResolution(){return this.isTimeHighResolution_;},set isTimeHighResolution(value){this.isTimeHighResolution_=value;},get canonicalUrl(){return this.canonicalUrl_;},set canonicalUrl(value){if(this.canonicalUrl_===value)return;if(this.canonicalUrl_!==undefined)throw new Error('canonicalUrl already set');this.canonicalUrl_=value;},importWarning:function(data){data.showToUser=!!data.showToUser;this.importWarnings_.push(data);if(this.reportedImportWarnings_[data.type]===true)return;if(this.importOptions_.showImportWarnings)console.warn(data.message);this.reportedImportWarnings_[data.type]=true;},get hasImportWarnings(){return this.importWarnings_.length>0;},get importWarnings(){return this.importWarnings_;},get importWarningsThatShouldBeShownToUser(){return this.importWarnings_.filter(function(warning){return warning.showToUser;});},autoCloseOpenSlices:function(){this.samples.sort(function(x,y){return x.start-y.start;});this.updateBounds();this.kernel.autoCloseOpenSlices();for(var pid in this.processes)this.processes[pid].autoCloseOpenSlices();},createSubSlices:function(){this.kernel.createSubSlices();for(var pid in this.processes)this.processes[pid].createSubSlices();},preInitializeObjects:function(){for(var pid in this.processes)this.processes[pid].preInitializeObjects();},initializeObjects:function(){for(var pid in this.processes)this.processes[pid].initializeObjects();},pruneEmptyContainers:function(){this.kernel.pruneEmptyContainers();for(var pid in this.processes)this.processes[pid].pruneEmptyContainers();},mergeKernelWithUserland:function(){for(var pid in this.processes)this.processes[pid].mergeKernelWithUserland();},computeWorldBounds:function(shiftWorldToZero){this.updateBounds();this.updateCategories_();if(shiftWorldToZero)this.shiftWorldToZero();},buildFlowEventIntervalTree:function(){for(var i=0;i<this.flowEvents.length;++i){var flowEvent=this.flowEvents[i];this.flowIntervalTree.insert(flowEvent);}this.flowIntervalTree.updateHighValues();},cleanupUndeletedObjects:function(){for(var pid in this.processes)this.processes[pid].autoDeleteObjects(this.bounds.max);},sortMemoryDumps:function(){this.globalMemoryDumps.sort(function(x,y){return x.start-y.start;});for(var pid in this.processes)this.processes[pid].sortMemoryDumps();},finalizeMemoryGraphs:function(){this.globalMemoryDumps.forEach(function(dump){dump.finalizeGraph();});},buildEventIndices:function(){this.modelIndices=new tr.model.ModelIndices(this);},sortAlerts:function(){this.alerts.sort(function(x,y){return x.start-y.start;});},applyObjectRefPatchups:function(){var unresolved=[];this.patchupsToApply_.forEach(function(patchup){if(patchup.pidRef in this.processes){var snapshot=this.processes[patchup.pidRef].objects.getSnapshotAt(patchup.scopedId,patchup.ts);if(snapshot){patchup.object[patchup.field]=snapshot;snapshot.referencedAt(patchup.item,patchup.object,patchup.field);return;}}unresolved.push(patchup);},this);this.patchupsToApply_=unresolved;},replacePIDRefsInPatchups:function(oldPidRef,newPidRef){this.patchupsToApply_.forEach(function(patchup){if(patchup.pidRef===oldPidRef){patchup.pidRef=newPidRef;}});},joinRefs:function(){this.joinObjectRefs_();this.applyObjectRefPatchups();},joinObjectRefs_:function(){tr.b.iterItems(this.processes,function(pid,process){this.joinObjectRefsForProcess_(pid,process);},this);},joinObjectRefsForProcess_:function(pid,process){tr.b.iterItems(process.threads,function(tid,thread){thread.asyncSliceGroup.slices.forEach(function(item){this.searchItemForIDRefs_(pid,'start',item);},this);thread.sliceGroup.slices.forEach(function(item){this.searchItemForIDRefs_(pid,'start',item);},this);},this);process.objects.iterObjectInstances(function(instance){instance.snapshots.forEach(function(item){this.searchItemForIDRefs_(pid,'ts',item);},this);},this);},searchItemForIDRefs_:function(pid,itemTimestampField,item){if(!item.args&&!item.contexts)return;var patchupsToApply=this.patchupsToApply_;function handleField(object,fieldName,fieldValue){if(!fieldValue||!fieldValue.id_ref&&!fieldValue.idRef)return;var scope=fieldValue.scope||tr.model.OBJECT_DEFAULT_SCOPE;var idRef=fieldValue.id_ref||fieldValue.idRef;var scopedId=new tr.model.ScopedId(scope,idRef);var pidRef=fieldValue.pid_ref||fieldValue.pidRef||pid;var ts=item[itemTimestampField];patchupsToApply.push({item:item,object:object,field:fieldName,pidRef:pidRef,scopedId:scopedId,ts:ts});}function iterObjectFieldsRecursively(object){if(!(object instanceof Object))return;if(object instanceof tr.model.ObjectSnapshot||object instanceof Float32Array||object instanceof tr.b.Quad)return;if(object instanceof Array){for(var i=0;i<object.length;i++){handleField(object,i,object[i]);iterObjectFieldsRecursively(object[i]);}return;}for(var key in object){var value=object[key];handleField(object,key,value);iterObjectFieldsRecursively(value);}}iterObjectFieldsRecursively(item.args);iterObjectFieldsRecursively(item.contexts);}};return{Model:Model};});