var mongoose = require('mongoose');
var validators = require('mongoose-validators');

var Like = mongoose.model('Like');

var Schema = mongoose.Schema,
	ObjectId = Schema.ObjectId;

/*
 * ProgramInfo will hold the program info for the candidate, may grow more complex over time.
 */

var ProgramInfoSchema = new Schema({
	title: String,
	body: String,
});

/*
 * Like holds support by a user
 */

var LikeSchema = new Schema({
	user: { type: ObjectId, ref: 'User', required: true } 
},
{ 
	timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

/*
 * Main schema for a candidate
 */

var CandidateSchema = new Schema({
	candidateId: { type: String, required: true },
	firstName: { type: String, required: true },
	lastName: { type: String, required: true },
	contact: {
		postal: { type: String, required: false },
		email: { type: String, validate: validators.isEmail({ skipEmpty: true }) },
		phone: { type: String, validate: validators.isMobilePhone('fr-FR', { skipEmpty: true }) },
	},
	links: {
		facebook: { type: String, validate: validators.isURL({ skipEmpty: true }) },
		personal: { type: String, validate: validators.isURL({ skipEmpty: true }) },
		twitter: { type: String, validate: validators.isURL({ skipEmpty: true }) },
		wikipedia: { type: String, validate: validators.isURL({ skipEmpty: true}) },
	},
	programInfo: ProgramInfoSchema,
	nominatorUser: { type: ObjectId, ref: 'User' },
	ownUser: { type: ObjectId, ref: 'User' },
	acceptedNominationAt: Date,
	lockedAt: Date,
	hiddenAt: Date,
	likes: [LikeSchema],
	comments; [{type: ObjectId, ref: 'Comment'}]
}, 
{ 
	timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

/*
 * Index definitions
 */

CandidateSchema.index({ createdAt: -1 });
CandidateSchema.index({ lockedAt: -1});
CandidateSchema.index({ hiddenAt: -1});
CandidateSchema.index({ candidateId: 1 });
CandidateSchema.index({ lastName: 1, firstName: 1 });

/*
 * Virtuals
 */

CandidateSchema.virtual('fullName').get(function () {
	if (this.status === 'hidden') return '';
	return this.firstName + ' ' + this.lastName;
});

CandidateSchema.virtual('numLikes').get(function () {
	if (this.status === 'hidden') return 0;
	return this.likes.length;
});

CandidateSchema.virtual('acceptedNomination').get(function () {
	if (this.status === 'hidden') return false;
	return (this.acceptedNominationAt && this.acceptedNominationAt.getTime() < Date.now());
}

CandidateSchema.virtual('status').get(function () {
	if (this.hiddenAt && this.hiddenAt.getTime() < Date.now()) {
		return 'hidden';
	} else if (this.lockedAt && this.lockedAt.getTime() < Date.now()) {
		return 'locked';
	} else {
		return 'active';
	}
});

CandidateSchema.virtual('active').get(function () {
	return this.status === 'active';
}

CandidateSchema.virtual('locked').get(function () {
	return this.status === 'locked';
}

CandidateSchema.virtual('hidden').get(function () {
	return this.status === 'hidden';
}

/*
 * Set JSON/Object transformations to keep sensitive data
 * and populate virtuals and referenced objects
 */

CandidateSchema.set('toObject', { getters: true });
CandidateSchema.set('toJSON', { getters: true });

CandidateSchema.options.toObject.transform = 
CandidateSchema.options.toJSON.transform = function(doc, ret) {
	// if hidden return plain object hiding all fields
	if (ret.hidden) ret = { status: 'hidden', hidden: true }; 
	// delete the individual like objects so likes are anonymous. Can use .numLikes virtual instead to get number of likes
	if (ret.likes) delete ret.likes;
};

/*
 * Pre-save hook to ensure against xss
 */

CandidateSchema.pre('save', function(next) {
	this.body = xss(this.body);
	next();
};

/*
 * Schema methods
 */

// LIKE

CandidateSchema.methods.like = function(user, cb) {
	if (!this.active) return cb(new Error('Candidate not active.'));
	if (this.likedBy(user)) return cb(new Error('Already liked by user.'));

	var like = new Like({ user: user });
	this.likes.push(like);
	this.save(cb);
};

// LIKED BY

TopicSchema.methods.likedBy = function(user) {
	if (!user || this.hidden) return false;

	var userLikes = getUserLikes(this.likes, getId(user));
	return userLikes.length === 1;
}

// UNLIKE

CandidateSchema.methods.unlike = function(user, cb) {
	if (!this.active) return cb(new Error('Candidate not active.'));
	var userLikes = getUserLikes(this.likes, getId(user)); 

	if (userLikes.length) userLikes.forEach(function(like) {
		likes.id(like.id).remove();
	});

	this.save(cb);
}

// LOCK

CandidateSchema.methods.lock = function(cb) {
	this.lockedAt = Date.now;
	this.save(cb);
}

// UNLOCK

CandidateSchema.methods.unlock = function(cb) {
	this.lockedAt = null;
	this.save(cb);
}

// HIDE

CandidateSchema.methods.hide = function(cb) {
	this.hiddenAt = Date.now;
	this.save(cb);
}

// UNHIDE

CandidateSchema.methods.unhide = function(cb) {
	this.hiddenAt = null;
	this.save(cb);
}

// UTILS

var getUserLikes = function(likes, user) {
	return likes.filter(function(like) {
		var likeUserId = getId(like.user);
		return thisUserId.equals ? thisUserId.equals(likeUserId) : thisUserId === likeUserId;
	});
};

var getId = function(ref) {
	return ref.get ? ref.get('_id') : ref;
}
