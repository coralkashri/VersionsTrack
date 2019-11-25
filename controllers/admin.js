const hash = require('../helpers/hash').get_hash_code;
const responses_gen = require('../helpers/responses');
const requests_handler = require('../helpers/requests_handler');
let users_model = require('../models/users');
const access_limitations = require('../helpers/configurations/access_limitations');



// View

exports.view_admin_panel = async (req, res, next) => {
    try {
        let cat_name = requests_handler.optional_param(req, "route", "category_name");
        let legal_cat_names = ["index", "users-management", "settings"];
        if (!legal_cat_names.includes(cat_name) && cat_name != null) {
            return res.redirect("/404");
        }

        res.render("pages/admin_panel", {
            access_level: req.session.user ? req.session.user.role : 1,
            is_logged_in: !!req.session.user,
            username: req.session.user && req.session.user.username,
            min_access_required: access_limitations.min_access_required,
            category_name: cat_name
        });
    } catch (e) {
        return responses_gen.generate_response(res, 400, null, e.message);
    }
};

exports.view_user_management_panel = async (req, res, next) => { // TODO complete this method
    try {
        let cat_name = requests_handler.optional_param(req, "route", "category_name");
        let legal_cat_names = ["index", "users-management", "settings"];
        if (!legal_cat_names.includes(cat_name) && cat_name != null) {
            return res.redirect("/404");
        }

        res.render("pages/admin_panel", {
            access_level: req.session.user ? req.session.user.role : 1,
            is_logged_in: !!req.session.user,
            username: req.session.user && req.session.user.username,
            min_access_required: access_limitations.min_access_required,
            category_name: cat_name
        });
    } catch (e) {
        return responses_gen.generate_response(res, 400, null, e.message);
    }
};