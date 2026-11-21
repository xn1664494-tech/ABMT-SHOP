(function () {
  'use strict';

  // CSRF config
  const CSRF_META = 'csrf-token';
  const CSRF_HEADER = 'X-CSRF-Token';
  let csrfPromise = null;

  // Default timeout
  const DEFAULT_TIMEOUT = 15000;

  /** Lấy CSRF token từ cookie; nếu thiếu thì gọi GET /api/auth/csrf một lần (dùng lại promise) */
  function getCsrfToken() {
    const match = document.cookie.match(new RegExp('(?:^|;\\s*)csrfToken=([^;]+)'));
    if (match) {
      return Promise.resolve(match[1]);
    }
    if (!csrfPromise) {
      csrfPromise = fetch('/api/auth/csrf', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
        .then((response) => {
          if (!response.ok) {
            return null;
          }
          return response.json();
        })
        .then((data) => {
          csrfPromise = null;
          return data && data.data && data.data.csrfToken ? data.data.csrfToken : null;
        })
        .catch(() => {
          csrfPromise = null;
          return null;
        });
    }
    return csrfPromise;
  }

  /** ApiError class */
  class ApiError extends Error {
    constructor(status, code, message, data, errors) {
      super(message);
      this.name = 'ApiError';
      this.status = status || 0;
      this.code = code || 'http';
      this.message = message;
      this.data = data;
      this.errors = errors;
    }
  }

  /** Core request function */
  async function request(method, url, options = {}) {
    const {
      body,
      query,
      headers: extraHeaders,
      timeout,
      signal: originalSignal
    } = options;

    // Build URL with query params
    let requestUrl = url;
    if (query && typeof query === 'object') {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value != null && value !== undefined) {
          params.append(key, String(value));
        }
      });
      if (params.toString()) {
        const separator = requestUrl.includes('?') ? '&' : '?';
        requestUrl = `${requestUrl}${separator}${params.toString()}`;
      }
    }

    // AbortController for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeout || DEFAULT_TIMEOUT);

    const baseHeaders = {
      Accept: 'application/json',
      ...extraHeaders
    };

    // Add CSRF header for write requests
    if (!/^(GET|HEAD)$/i.test(method)) {
      const csrfToken = await getCsrfToken();
      if (csrfToken) {
        baseHeaders['X-CSRF-Token'] = csrfToken;
      }
    }

    const fetchOptions = {
      method,
      credentials: 'same-origin',
      signal: abortController.signal,
      headers: baseHeaders
    };

    // Add body if provided
    if (body && typeof body === 'object') {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(body);
    }

    const performRequest = async (csrfToken) => {
      const headers = { ...baseHeaders };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      const opts = {
        method,
        credentials: 'same-origin',
        signal: abortController.signal,
        headers
      };
      if (body && typeof body === 'object') {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      const response = await fetch(requestUrl, opts);
      clearTimeout(timeoutId);
      const contentType = response.headers.get('content-type');

      // 204 No Content → null
      if (response.status === 204) {
        return null;
      }

      // Try to parse JSON if content-type indicates JSON
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Success: return parsed data (or text if not JSON)
      if (response.ok) {
        return contentType && contentType.includes('application/json') ? data : { text: data, ok: true };
      }

      // Error: build ApiError
      let message, code;
      let errData = null;
      let errs = null;

      if (contentType && contentType.includes('application/json') && typeof data === 'object' && data !== null) {
        errData = data;
        if (errData.errors instanceof Object || Array.isArray(errData.errors)) {
          errs = errData.errors;
        } else if (Array.isArray(errData.details)) {
          errs = errData.details;
        }
        message = data.message || data.error;
      }

      const status = response.status;

      const defaultMessages = {
        400: 'Yêu cầu không hợp lệ.',
        401: 'Vui lòng đăng nhập để tiếp tục.',
        403: 'Bạn không có quyền thực hiện thao tác này.',
        404: 'Không tìm thấy dữ liệu yêu cầu.',
        409: 'Dữ liệu đã thay đổi, vui lòng thử lại.',
        422: 'Thông tin chưa hợp lệ, vui lòng kiểm tra lại.',
        429: 'Bạn thao tác quá nhanh, vui lòng thử lại sau.',
        500: 'Máy server đang gặp sự cố, vui lòng thử lại sau.',
        502: 'Máy server đang gặp sự cố, vui lòng thử lại sau.',
        503: 'Máy server đang gặp sự cố, vui lòng thử lại sau.'
      };

      if (message) {
        code = 'http';
      } else {
        code = 'http';
        message = defaultMessages[status] || 'Máy server đang gặp sự cố, vui lòng thử lại.';
      }

      throw new ApiError(status, code, message, errData, errs);
    };

    try {
      return await performRequest();
    } catch (err) {
      // Lỗi CSRF: lấy token mới và thử lại đúng 1 lần
      if (err instanceof ApiError && err.status === 403 && /csrf/i.test(err.message || '')) {
        csrfPromise = null;
        const newToken = await getCsrfToken();
        if (newToken) {
          return await performRequest(newToken);
        }
      }
      // Network or timeout error
      if (err.name === 'AbortError') {
        throw new ApiError(0, 'timeout', 'Máy server phản hồi quá lâu, vui lòng thử lại.');
      }
      if (err instanceof ApiError) {
        throw err;
      }
      throw new ApiError(0, 'network', 'Không kết nối được tới máy chủ.');
    }
  }

  /** Utility methods */
  const api = {
    get(url, options = {}) {
      return request('GET', url, options);
    },
    post(url, body, options = {}) {
      return request('POST', url, { ...options, body });
    },
    put(url, body, options = {}) {
      return request('PUT', url, { ...options, body });
    },
    patch(url, body, options = {}) {
      return request('PATCH', url, { ...options, body });
    },
    delete(url, options = {}) {
      return request('DELETE', url, options);
    },
    /** Alias */
    del(url, options = {}) {
      return request('DELETE', url, options);
    },

    /** Optional callback on 401 */
    onUnauthorized(error) {
      // Default: do nothing; override if needed
    },
    ApiError
  };

  // Expose only window.ABMT, don't override existing
  if (window.ABMT === undefined) {
    window.ABMT = {};
  }
  window.ABMT.api = api;

})();
