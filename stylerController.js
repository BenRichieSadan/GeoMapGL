mod.controller('stylerController', ['$scope',
    function ($scope) {

        /**
         * variables
         */

        /**
         * watches
         */
        $scope.$watch('widget', function (val) {
            //  Get a reference to the list of basemaps
            $scope.basemapOptions = settings.basemaps;

            $scope.model = $$get($scope, 'widget.style');
        });
        
        $scope.changeBasemap = function (basemap) {

            //apply changes
            $scope.widget.style.baseMap = basemap.value;

            $scope.$root.widget.redraw();
        };

        /**
         * public methods
         */
    }
]);