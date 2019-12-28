angular.module("searchM", [])
    .service("versions_search_s", function() {
        let _$scope, _$http, timers_manager_s, _preloader;
        let search_container = $(".search-container");
        let search_status = "close"; // ["close", "open-quick", "open-full"]

        // Cancel table animation for some data
        function cancel_table_animation() {
            let versions_table = $("#versions_table");
            versions_table.removeClass('animated');
        }

        function apply_table_animation() {
            let versions_table = $("#versions_table");
            versions_table.addClass('animated');
        }

        function cancel_edit_state() {
            if (!_$scope.versions_table_conf.version_update_lock && !_$scope.versions_table_conf.properties_update_lock) {
                _$scope.version_edit_progress = {
                    is_active: false,
                    version: ""
                };
            }
        }

        function make_readable_date(unreadable_date) {
            let date_info = unreadable_date.split('T');
            let date = new Date(date_info[0] + " EDT");
            let splitter = '-';
            return date.getDate() + splitter + (date.getMonth() + 1) + splitter + date.getFullYear();
        }

        function update_new_versions_list_properties(v_list) {
            v_list.forEach((version) => {
                version.release_date = make_readable_date(version.release_date);
                version.view_state = true;
                version.properties_current_page = 1;
                version.properties.forEach((property) => {
                    property.view_state = true;
                });
            });
        }

        function is_table_update_enable(force_update, new_versions_list) {
            // Is there is an active edit lock by the user
            let not_updating_state = !_$scope.versions_table_conf.version_update_lock && !_$scope.versions_table_conf.properties_update_lock;

            // Is there is any detected change between the current list and the new list?
            let change_detected = !_$scope.versions_list || new_versions_list.length !== _$scope.versions_list.length ||
                (new_versions_list && new_versions_list.length && new_versions_list[0].version !== _$scope.versions_list[0].version);

            return force_update || not_updating_state && change_detected;
        }

        function splitMulti(str, tokens){
            var tempChar = tokens[0]; // We can use the first token as a temporary join character
            for(var i = 1; i < tokens.length; i++){
                str = str.split(tokens[i]).join(tempChar);
            }
            str = str.split(tempChar);
            return str;
        }

        function mark() {

            // Read the keyword
            let keyword = _$scope.version_data_filter_model;

            // Determine selected options
            let options = {
                separateWordSearch: true,
                diacritics: true,
                accuracy: "partially"
                //accuracy: ["complementary", "partially", "exactly"]
            };

            // Remove previous marked elements and mark
            // the new keyword inside the context
            $("#page_content").unmark({
                done: function() {
                    $("#page_content").mark(keyword, options);
                }
            });
        }

        /**
         * If ver1 is bigger => Returns -1
         * If ver2 is bigger => Returns 1
         * If the versions are equals => Returns 0
         *
         * Note: Working the same way with dates in format: yyyy-mm-dd
         *
         * @param ver1
         * @param ver2
         * @returns 1/-1/0
         */
        let compare_two_versions = (ver1, ver2) => {
            let ver1_data = splitMulti(ver1.version, ['.', '-', 'T',':','Z']);
            let ver2_data = splitMulti(ver2.version, ['.', '-', 'T',':','Z']);
            let min_length = Math.min(ver1_data.length, ver2_data.length);
            let max_length = Math.max(ver1_data.length, ver2_data.length);
            let i;
            for (i = 0; i < min_length; i++) {
                if (Number(ver1_data[i]) > Number(ver2_data[i])) {
                    return -1;
                } else if (Number(ver1_data[i]) < Number(ver2_data[i])) {
                    return 1;
                }
            }

            if (min_length !== max_length) {
                let data_to_check;
                let suspect_sign;
                if (ver1_data.length === max_length) { data_to_check = ver1_data; suspect_sign = -1; }
                else { data_to_check = ver2_data; suspect_sign = 1; }
                for (i; i < max_length; i++) {
                    if (Number(data_to_check[i]) !== 0) return suspect_sign;
                }
            }

            return 0;
        };

        function sort_versions_list_by_version(versions_list) {
            versions_list.sort(compare_two_versions);
        }

        this.init = ($scope, $http, timers_manager_s, preloader) => {
            _$http = $http;
            _$scope = $scope;
            timers_manager_s = timers_manager_s;
            _preloader = preloader;

            _$scope.search = (force_update, single_search) => {
                let route;
                switch (_$scope.versions_filter_select_model) {
                    case "equal":
                        route = "/api/versions/";
                        break;

                    case "after":
                        route = "/api/versions/gt_";
                        break;

                    case "before":
                        route = "/api/versions/lt_";
                        break;
                }
                let deferred = $.Deferred();

                if (_$scope.version_data_filter_model) {
                    let data;
                    switch (_$scope.versions_filter_type_select_model) {
                        case "ver":
                            route += "v";
                            data = _$scope.version_data_filter_model;
                            break;

                        case "desc":
                            route += "desc-";
                            data = _$scope.version_data_filter_model;
                            break;

                        case "date":
                            alertify.error("Error occurred in client side: Date filter detected but didn't applied correctly.");
                            break;
                    }
                    route += data;
                } else if ($("#filter_version_release_date").val()) {
                    route += "d";
                    route += new Date($("#filter_version_release_date").val() + "EDT");
                    //let extracted_date_data = date_data.split(['-', '/', '.', ' ']);
                    //let formatted_date = extracted_date_data// yyyy-mm-dd
                } else {
                    route = "/api/versions/all";
                }

                if (force_update) {
                    _preloader.start();
                }

                let new_versions_list;
                _$http({
                    method: "GET",
                    url: route,
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
                }).then((response) => {
                    response = response.data;
                    cancel_table_animation();
                    new_versions_list = response.data;
                    cancel_edit_state();
                    update_new_versions_list_properties(new_versions_list);
                    if (_$scope.versions_filter_type_select_model !== "desc" || !_$scope.version_data_filter_model) {
                        // Sort by version
                        sort_versions_list_by_version(new_versions_list);
                    }
                    if (is_table_update_enable(force_update, new_versions_list)) {
                        apply_table_animation();
                        _$scope.versions_list = new_versions_list;
                        alertify.success(response.message);
                    }
                    if (_$scope.versions_filter_type_select_model === "desc" && _$scope.version_data_filter_model) {
                        mark();
                    }
                }, (response) => {
                    let msg;
                    if (response.data) {
                        response = response.data;
                        msg = response.message;
                    } else {
                        msg = "Connection error";
                    }
                    alertify.error(msg);
                }).finally(() => {
                    _preloader.stop();
                    let is_timer_exists = timers_manager_s.is_exists("versions_search");
                    let is_timer_running = timers_manager_s.is_timer_running("versions_search");
                    if (!single_search && (!is_timer_exists || is_timer_running)) {
                        if (!is_timer_exists) timers_manager_s.add_timer("versions_search", _ => _$scope.search(), 2000);
                        timers_manager_s.start_timer("versions_search");
                    }

                    deferred.resolve("Search ended");
                    /* To wait to finally state, use:
                    $scope.search()
                    .done(
                        after_search.bind(null, param1, param2, ...)
                    );*/
                });
                return deferred.promise();
            };

            _$scope.clear_search = () => {
                _$scope.version_data_filter_model = "";
                _$scope.version_date_data_filter_model = "";
                let version_rel_date_filter = $("#filter_version_release_date");
                version_rel_date_filter.val("");
                version_rel_date_filter.trigger("change");
                _$scope.search(false, true);
                if (search_status.split('-')[0] === "open") {
                    search_container.addClass("full-search-btn-container");
                    search_container.removeClass("apply-search-container");
                }
                timers_manager_s.start_timer("versions_search");
            };

            _$scope.close_search = () => {
                search_container.removeClass("full-search-btn-container apply-search-container");
                search_status = "close";

            };

            _$scope.update_advanced_description_search_sliders = (is_add, current_slider_id) => {
                let sliders = $("#" + current_slider_id);
                let availableTotal = 1;

                sliders.each(function() {
                    if (!$(this).attr("slider_initialized")) $(this).range();
                    $(this).attr("slider_initialized", true);
                    $(this).off("input");
                    $(this).off("change");
                    function calculate_max() {
                        let total = 0;

                        let sliders = $(".active .special-slider");
                        sliders.each(function () {
                            total += Number($(this).val());
                        });

                        let max = availableTotal - total;
                        return max;
                    }
                    function update_sliders(max, sliders) {
                        // Update each slider
                        sliders.each(function () {
                            let t = $(this), value = Number(t.val());
                            t.attr("max", max + value);
                            t.val(value);
                        });
                    }
                    $(this).on("input", _ => {
                        let sliders = $(".active .special-slider");
                        let max = calculate_max();
                        update_sliders(max, sliders.not(this))
                    });
                    $(this).on("change", _ => {
                        let sliders = $(".active .special-slider");
                        let max = calculate_max();
                        update_sliders(max, sliders.not(this))
                    });
                    let sliders;
                    if (is_add) {
                        sliders = $(this);
                    }
                    else {
                        $(this).val(0);
                        sliders = $(".active .special-slider");
                    }
                    let max = calculate_max();
                    update_sliders(max, sliders);
                });
            };

            _$scope.open_search = (type) => {
                switch (type) {
                    case "quick":
                        if (search_status.split('-')[0] === "open" && search_status.split('-')[1] === type) return;
                        search_container.addClass("full-search-btn-container");
                        search_container.removeClass("apply-search-container");
                        break;

                    case "full":
                        timers_manager_s.pause_timer("versions_search");
                        $('#advanced_search_version_modal').modal('open');
                        break;
                }
                search_status = "open-" + type;
            };

            _$scope.update_quick_full_search_btn = () => {
                if (search_status === "close") return;
                switch (_$scope.versions_filter_type_select_model) {
                    case "ver":
                    case "desc":
                        if (_$scope.version_data_filter_model) {
                            search_container.removeClass("full-search-btn-container");
                            search_container.addClass("apply-search-container");
                            timers_manager_s.pause_timer("versions_search");
                        } else {
                            search_container.addClass("full-search-btn-container");
                            search_container.removeClass("apply-search-container");
                        }
                        break;

                    case "date":
                        search_container.removeClass("full-search-btn-container");
                        search_container.addClass("apply-search-container");
                        timers_manager_s.pause_timer("versions_search");
                        break;
                }
            };

            _$scope.change_data_input_type = () => {
                switch (_$scope.versions_filter_type_select_model) {
                    case "ver":
                    case "desc":
                        _$scope.versions_filter_select_model = "equal";
                        $("#versions_version_type_filter_select").val(_$scope.versions_filter_select_model); // should auto update
                        break;

                    case "date":
                        _$scope.versions_filter_select_model = "before";
                        $("#versions_date_type_filter_select").val(_$scope.versions_filter_select_model); // should auto update
                        break;
                }
                $('select').formSelect();
                _$scope.clear_search();
                _$scope.update_quick_full_search_btn();
            };

            _$scope.search_version = (version_id) => {
                _$scope.versions_filter_type_select_model = 'ver';
                _$scope.version_data_filter_model = version_id;
                _$scope.versions_filter_select_model = "equal";
                _$scope.open_search("quick");
                _$scope.update_quick_full_search_btn();
                _$scope.search(false, true);
                scroll_to_top();
            };
        };

        this.update_last_version = () => {
            _$http({
                method: "GET",
                url: "/api/versions/all",
                headers: {'Content-Type': 'application/x-www-form-urlencoded'}
            }).then((response) => {
                response = response.data;
                let versions_list = response.data;
                versions_list.sort((elem1, elem2) => {
                    if (elem1.version > elem2.version) return -1;
                    if (elem1.version < elem2.version) return 1;
                    return 0;
                });
                _$scope.last_version = versions_list[0];
            }, (response) => {
                response = response.data;
                alertify.error(response.message);
            });
        }
    });