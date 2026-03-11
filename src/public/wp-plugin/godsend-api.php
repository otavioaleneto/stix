<?php
/**
 * Plugin Name: GODSend API Bridge
 * Plugin URI: https://github.com/godsend-cms
 * Description: REST API endpoint for GODSend CMS - Returns all WordPress users with their PMPro membership levels.
 * Version: 2.0.0
 * Author: GODSend Team
 * License: GPL v2 or later
 * Text Domain: godsend-api
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('rest_api_init', function () {
    register_rest_route('godsend/v1', '/members', array(
        'methods'  => 'GET',
        'callback' => 'godsend_get_members',
        'permission_callback' => 'godsend_check_permission',
    ));

    register_rest_route('godsend/v1', '/stats', array(
        'methods'  => 'GET',
        'callback' => 'godsend_get_stats',
        'permission_callback' => 'godsend_check_permission',
    ));

    register_rest_route('godsend/v1', '/auth', array(
        'methods'  => 'GET',
        'callback' => 'godsend_authenticate_user',
        'permission_callback' => 'godsend_check_permission',
    ));
});

function godsend_check_permission($request) {
    $auth_header = $request->get_header('Authorization');
    if (!$auth_header) {
        return new WP_Error('rest_forbidden', 'Authentication required.', array('status' => 401));
    }

    if (strpos($auth_header, 'Basic ') === 0) {
        $credentials = base64_decode(substr($auth_header, 6));
        $parts = explode(':', $credentials, 2);
        if (count($parts) === 2) {
            $user = wp_authenticate($parts[0], $parts[1]);
            if (!is_wp_error($user) && user_can($user, 'list_users')) {
                return true;
            }

            $user = get_user_by('login', $parts[0]);
            if (!$user) {
                $user = get_user_by('email', $parts[0]);
            }
            if ($user && wp_check_password($parts[1], $user->data->user_pass, $user->ID)) {
                if (user_can($user, 'list_users')) {
                    return true;
                }
            }
        }
    }

    if (strpos($auth_header, 'Bearer ') === 0) {
        $token = substr($auth_header, 7);
        $api_key = get_option('godsend_api_key', '');
        if ($api_key && hash_equals($api_key, $token)) {
            return true;
        }
    }

    return new WP_Error('rest_forbidden', 'Invalid credentials or insufficient permissions.', array('status' => 403));
}

function godsend_authenticate_user($request) {
    $login = sanitize_text_field($request->get_param('login'));
    $password = $request->get_param('password');

    if (empty($login) || empty($password)) {
        return new WP_REST_Response(array(
            'success' => false,
            'error'   => 'Login and password are required.',
        ), 400);
    }

    $user = wp_authenticate($login, $password);

    if (is_wp_error($user)) {
        $user_obj = get_user_by('email', $login);
        if ($user_obj) {
            $user = wp_authenticate($user_obj->user_login, $password);
        }
    }

    if (is_wp_error($user)) {
        return new WP_REST_Response(array(
            'success' => false,
            'error'   => 'Invalid login or password.',
        ), 200);
    }

    $has_pmpro = function_exists('pmpro_getMembershipLevelForUser');
    $level_id = null;
    $level_name = null;
    $status = 'active';

    if ($has_pmpro) {
        $level = pmpro_getMembershipLevelForUser($user->ID);
        if ($level) {
            $level_id = intval($level->id);
            $level_name = $level->name;
        } else {
            $status = 'none';
        }
    } else {
        $roles = $user->roles;
        $level_name = !empty($roles) ? implode(', ', $roles) : 'none';
    }

    return new WP_REST_Response(array(
        'success'    => true,
        'user_id'    => $user->ID,
        'username'   => $user->user_login,
        'email'      => $user->user_email,
        'name'       => $user->display_name,
        'level_id'   => $level_id,
        'level_name' => $level_name,
        'status'     => $status,
        'has_pmpro'  => $has_pmpro,
    ), 200);
}

function godsend_get_members($request) {
    $page = max(1, intval($request->get_param('page') ?: 1));
    $per_page_raw = $request->get_param('per_page');
    $per_page = ($per_page_raw !== null && $per_page_raw !== '') ? intval($per_page_raw) : 0;
    if ($per_page > 500) $per_page = 500;
    if ($per_page < 0) $per_page = 0;
    $search = sanitize_text_field($request->get_param('search') ?: '');

    $has_pmpro = function_exists('pmpro_getMembershipLevelForUser') || class_exists('MemberOrder');

    $args = array(
        'orderby' => 'registered',
        'order'   => 'DESC',
        'fields'  => array('ID', 'user_login', 'user_email', 'display_name', 'user_registered'),
    );

    if ($search) {
        $args['search'] = '*' . $search . '*';
        $args['search_columns'] = array('user_login', 'user_email', 'display_name');
    }

    if ($per_page > 0) {
        $args['number'] = $per_page;
        $args['offset'] = ($page - 1) * $per_page;
    }

    $user_query = new WP_User_Query($args);
    $users = $user_query->get_results();
    $total = $user_query->get_total();

    $members = array();
    foreach ($users as $user) {
        $member_data = array(
            'id'         => $user->ID,
            'username'   => $user->user_login,
            'email'      => $user->user_email,
            'name'       => $user->display_name,
            'registered' => $user->user_registered,
            'level_id'   => null,
            'level_name' => null,
            'status'     => 'active',
        );

        if ($has_pmpro) {
            $level = pmpro_getMembershipLevelForUser($user->ID);
            if ($level) {
                $member_data['level_id'] = intval($level->id);
                $member_data['level_name'] = $level->name;
                $member_data['status'] = 'active';
            } else {
                $member_data['status'] = 'none';
            }
        } else {
            $roles = get_userdata($user->ID)->roles;
            $member_data['level_name'] = !empty($roles) ? implode(', ', $roles) : 'none';
        }

        $members[] = $member_data;
    }

    $response = array(
        'success'  => true,
        'total'    => $total,
        'page'     => $page,
        'per_page' => $per_page > 0 ? $per_page : $total,
        'pages'    => $per_page > 0 ? ceil($total / $per_page) : 1,
        'has_pmpro' => $has_pmpro,
        'members'  => $members,
    );

    return new WP_REST_Response($response, 200);
}

function godsend_get_stats($request) {
    $total_users = count_users();
    $has_pmpro = function_exists('pmpro_getMembershipLevelForUser');

    $stats = array(
        'success'     => true,
        'total_users' => $total_users['total_users'],
        'has_pmpro'   => $has_pmpro,
        'roles'       => $total_users['avail_roles'],
        'levels'      => array(),
    );

    if ($has_pmpro && function_exists('pmpro_getAllLevels')) {
        $levels = pmpro_getAllLevels(true, true);
        foreach ($levels as $level) {
            $stats['levels'][] = array(
                'id'   => $level->id,
                'name' => $level->name,
            );
        }
    }

    return new WP_REST_Response($stats, 200);
}

add_action('admin_menu', function () {
    add_options_page(
        'GODSend API',
        'GODSend API',
        'manage_options',
        'godsend-api',
        'godsend_settings_page'
    );
});

function godsend_settings_page() {
    if (isset($_POST['godsend_generate_key']) && wp_verify_nonce($_POST['_wpnonce'], 'godsend_settings')) {
        $key = wp_generate_password(32, false);
        update_option('godsend_api_key', $key);
        echo '<div class="notice notice-success"><p>New API key generated.</p></div>';
    }

    $api_key = get_option('godsend_api_key', '');
    $site_url = get_site_url();
    ?>
    <div class="wrap">
        <h1>GODSend API Bridge v2.0</h1>
        <p>This plugin provides REST API endpoints for the GODSend CMS to fetch user/membership data and authenticate users.</p>

        <h2>API Endpoints</h2>
        <table class="widefat">
            <thead><tr><th>Endpoint</th><th>Description</th></tr></thead>
            <tbody>
                <tr><td><code>/wp-json/godsend/v1/members</code></td><td>List all users with membership levels</td></tr>
                <tr><td><code>/wp-json/godsend/v1/stats</code></td><td>Site statistics and PMPro levels</td></tr>
                <tr><td><code>/wp-json/godsend/v1/auth</code></td><td>Authenticate a user (login + password)</td></tr>
            </tbody>
        </table>

        <h2>Authentication</h2>
        <p>You can use <strong>Basic Auth</strong> (WordPress admin username:password) or a <strong>Bearer Token</strong>:</p>

        <?php if ($api_key): ?>
            <p><strong>Current API Key:</strong> <code><?php echo esc_html($api_key); ?></code></p>
        <?php else: ?>
            <p>No API key generated yet.</p>
        <?php endif; ?>

        <form method="post">
            <?php wp_nonce_field('godsend_settings'); ?>
            <p><input type="submit" name="godsend_generate_key" class="button button-primary" value="Generate New API Key"></p>
        </form>

        <h2>GODSend CMS Settings</h2>
        <p>In your GODSend CMS settings page (WordPress section), use these values:</p>
        <ul>
            <li><strong>Site URL:</strong> <code><?php echo esc_html($site_url); ?></code></li>
            <li><strong>Consumer Key:</strong> Your WordPress admin username</li>
            <li><strong>Consumer Secret:</strong> Your WordPress admin password</li>
        </ul>

        <h2>Parameters</h2>
        <h3>/members</h3>
        <table class="widefat">
            <thead><tr><th>Parameter</th><th>Description</th><th>Default</th></tr></thead>
            <tbody>
                <tr><td><code>page</code></td><td>Page number</td><td>1</td></tr>
                <tr><td><code>per_page</code></td><td>Items per page (max 500, 0 = all)</td><td>0 (all)</td></tr>
                <tr><td><code>search</code></td><td>Search by username, email or display name</td><td></td></tr>
            </tbody>
        </table>
        <h3>/auth</h3>
        <table class="widefat" style="margin-top:10px">
            <thead><tr><th>Parameter</th><th>Description</th><th>Required</th></tr></thead>
            <tbody>
                <tr><td><code>login</code></td><td>Username or email</td><td>Yes</td></tr>
                <tr><td><code>password</code></td><td>User password</td><td>Yes</td></tr>
            </tbody>
        </table>
    </div>
    <?php
}
